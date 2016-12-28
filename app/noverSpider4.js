var http = require('http'),
    async = require('async'),
    mkdirp = require('mkdirp'),
    stream = require('stream'),
    fs = require('fs'),
    path = require('path'),
    log4js = require('log4js'),
    request = require('request'),
    charset = require('charset'),
    zlib = require('zlib'),
    iconv = require('iconv-lite'),
    _ = require('lodash'),
    Q = require('q'),
    readline = require('readline2')

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('close', function(){
    process.exit(0);
})


var NovelSpider = function(options){
    _.extend(this, {
        novelName: '',
        novelUrl: '',
        novelCatalog: [{
            bookName: '第一卷',
            bookSections: [{
                sectionName: '第一章',
                sectionUrl: ''
            }, {
                sectionName: '第二章',
                sectionUrl: ''
            }]
        }, {
            bookName: '第二卷',
            bookSections: [{
                sectionName: '第一章',
                sectionUrl: ''
            }, {
                sectionName: '第二章',
                sectionUrl: ''
            }]
        }],
        parseNovelData: function(html){return html},
        parseNovelCatalog: function(html){return html}
    }, options || {})
    this.path = path.join(__dirname, '..', '/novels/'+this.novelName)
    mkdirp.sync(this.path);
    log4js.configure({
        appenders: [
            {type: 'console', category: 'console'},
            {type: 'file', filename: this.path+'/error.log', category: 'error' },
            {type: 'file', filename: this.path+'/success.log', category: 'success'}
        ]
    })
    this.successLog = log4js.getLogger('success');
    this.errorLog = log4js.getLogger('error');
    this.consoleLog = log4js.getLogger('console');
}

var proto = NovelSpider.prototype;
proto.start = function(){
    var self = this;
    this.getNovelCatalog().then(function(catalog){
        self.selectOption(catalog)
    });
}
proto.selectOption = function(catalog){
    var ques = ['全部抓取','单卷抓取','合并'], self=this;
    ques = ques.map(function(item, i){
        return '['+(i+1)+']'+item+'\r\n'
    }).join('') + '[0]退出\r\n';
    rl.question(ques, function(answer){
        switch(answer){
            case '1': self.spideAll(catalog); break;
            case '2': self.spideByName(catalog); break;
            case '3': self.concatBook(catalog.map(function(book){return book.bookName;})).then(function(){rl.close();}); break;
            case '0': process.exit(0); break;
            default: console.error('输入错误'); self.selectOption(catalog); break;
        }
    })
}
proto.getNovelCatalog = function(){
    var self = this;
    this.consoleLog.trace('开始获取目录')
    return this.getPageByUrl(this.novelUrl).then(function(html){
        self.novelCatalog = self.parseNovelCatalog(html);
        if(!self.novelCatalog || self.novelCatalog.length<=0){
            self.errorLog.error('目录解析失败');
        } else {
            self.successLog.info('目录获取成功');
            return self.novelCatalog;
        }
    }, function(msg){
        self.errorLog.error('目录获取失败', msg);
    })
}

proto.spideByName = function(catalog){
    var self = this;
    rl.question('请输入卷名: ', function(answer){
        if(answer){
            var book;
            catalog.some(function(bk){
                if(bk.bookName === answer){
                    book = bk;
                    return true;
                } else {
                    return false;
                }
            });
            if(book){
                rl.question('请输入开始链接,回车获取全卷 ', function(link){
                    self.spideBook(book, link).then(function(bookName){
                        self.selectOption(catalog);
                    }, function(){
                        rl.close();
                    })
                })
            } else {
                console.error('无此卷名');
                self.spideByName(catalog);
            }
        } else {
            self.selectOption(catalog);
        }
    })
}

proto.spideAll = function(catalog){
    var self = this;
    async.mapLimit(catalog, 5, function(book, cb){
        self.spideBook(book).then(function(bookName){
            cb(null, bookName);
        }, function(){
            cb('something wrong');
        });
    }, function(err, bookNames){
        if(err){
            rl.close();
        } else {
            self.concatBook(bookNames).then(function(){
                rl.close();
            });
        }
    });
}

proto.spideBook = function(book, link){
    var deferred = Q.defer(), n=0, section, self=this;
    var writeStream = fs.createWriteStream(this.path+'/'+book.bookName+'.txt', {flags: 'a'}),
        readStream = new stream.Readable();
    readStream._read = function(){};
    readStream.pipe(writeStream);
    if(!link){
        readStream.push('# '+book.bookName+'\r\n');
    }
    if(link && !book.bookSections.some(function(bkSec, ix){
        if(bkSec.sectionUrl == link){
            n = ix;
            return true;
        }
        return false;
    })){
        console.error('找不到链接');
        deferred.reject();
        return deferred.promise;
    }
    section = book.bookSections[n];
    self.consoleLog.trace('开始获取', book.bookName);
    function spideError(){
        readStream.push(null);
        deferred.reject();
    }
    function spideSuccess(text){
        text = '## '+section.sectionName+'\r\n'+text+'\r\n';
        readStream.push(text);
        n++;
        section = book.bookSections[n];
        if(section){
            self.spideSection(section).then(spideSuccess, spideError);
        } else {
            readStream.push(null);
            self.successLog.info('获取成功', book.bookName);
            deferred.resolve(book.bookName);
        }
    }
    this.spideSection(section).then(spideSuccess, spideError)
    return deferred.promise;
}

proto.spideSection = function(section){
    var self = this, deferred = Q.defer();
    this.getPageByUrl(section.sectionUrl).then(function(html){
        var text = self.parseNovelData(html);
        if(text){
            deferred.resolve(text);
        } else {
            self.errorLog.error('解析失败', section.sectionName, section.sectionUrl);
            deferred.reject();
        }
    }, function(msg){
        self.errorLog.error('获取失败',section.sectionUrl, msg);
        deferred.reject()
    })
    return deferred.promise;
}

proto.concatBook = function(bookNames){
    var self = this, deferred = Q.defer();
    var writeStream = fs.createWriteStream(this.path+'/全本.txt');
    this.consoleLog.trace('开始合并');
    function concat(n){
        var bookName = bookNames[n];
        var readStream = fs.createReadStream(self.path+'/'+bookName+'.txt');
        readStream.on('end', function(){
            self.consoleLog.info('合并成功', bookName);
            n++;
            if(bookNames[n]){
                concat(n);
            } else {
                self.consoleLog.info('全部合并成功');
                writeStream.end();
                deferred.resolve();
            }
        })
        readStream.pipe(writeStream, {end: false})
    }
    concat(0);
    return deferred.promise;
}

proto.getPageByUrl = function(url){
    var deferred = Q.defer();
    request({
        url: url,
        encoding: null
    }, function(error, response, body){
        console.log(url)
        if(error){
            console.error('error', error);
            deferred.reject(error);
            return;
        }
        if(response.statusCode != 200){
            console.error('statusCode', response.statusCode)
            deferred.reject(response.statusCode)
            return;
        }
        try{
            var buffer = body;
            if(response.headers['content-encoding'] == 'gzip'){
                buffer = zlib.gunzipSync(body);
            }
            var encoding = charset(response.headers, buffer);
            deferred.resolve(iconv.decode(buffer, encoding))
        } catch(e){
            console.error(response.headers);
            deferred.reject(e)
        }
    })
    return deferred.promise;
}

module.exports = NovelSpider