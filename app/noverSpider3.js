var http = require('http');
var extend = require('./extend');
var async = require('async');
var mkdirp = require('mkdirp');
var stream = require('stream');
var fs = require('fs');
var path = require('path');
var log4js = require('log4js');
var request = require('request');
var charset = require('charset');
var zlib = require('zlib');
var iconv = require('iconv-lite');


var NovelSpider = function(options){
    extend(this, {
        novelName: '',
        novelUrl: '',
        novelData: [{
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
        parseNovelSection: function(html){return html},
        parseNovelData: function(html){return html}
    }, options || {});
    this.path = path.join(__dirname, '..', '/novels/'+this.novelName)
    mkdirp.sync(this.path);
    log4js.configure({
        appenders: [
            {type: 'console', category: 'success'},
            {type: 'file', filename: this.path+'/error.log', category: 'error' }
        ]
    })
    this.successLog = log4js.getLogger('success');
    this.errorLog = log4js.getLogger('error');
}

var proto = NovelSpider.prototype;
proto.start = function(){
    this.getNovelData();
}
proto.getNovelData = function(){
    var self = this;
    self.successLog.trace('开始获取目录');
    this.getData(this.novelUrl).then(function(html){
        self.novelData = self.parseNovelData(html);
        if(!self.novelData || self.novelData.length<=0){
            self.errorLog.error('目录解析失败');
        } else {
            self.successLog.info('目录获取成功');
            self.spideNovel();
        }
    }, function(msg){
        self.errorLog.error('目录获取失败', msg);
    })
}
proto.spideNovel = function(){
    var self = this;
    async.mapLimit(this.novelData, 5, function(book, cb){
        self.spideBook(book, cb);
    }, function(){
        self.concatBook();
    });
}
proto.spideBook = function(bookData, cb){
    var n = 0;
    var section = bookData.bookSections[n];
    var self = this;
    var writeStream = fs.createWriteStream(this.path+'/'+bookData.bookName+'.txt');
    var readStream = new stream.Readable();
    readStream._read = function(){};
    writeStream.on('finish', function(){
        self.successLog.info('获取成功', bookData.bookName);
        cb();
    });
    readStream.pipe(writeStream);
    readStream.push('# '+bookData.bookName+'\r\n');
    this.successLog.trace('开始获取', bookData.bookName);
    function spideError(err){
        readStream.push(null);
    }
    function spideSuccess(text){
        text = ('## '+section.sectionName+'\r\n'+text+'\r\n');
        readStream.push(text);
        n++;
        section = bookData.bookSections[n];
        if(section){
            self.spideSection(section).then(spideSuccess, spideError);
        } else {
            readStream.push(null);
        }
    }
    this.spideSection(section).then(spideSuccess, spideError);
}
proto.spideSection = function(sectionData){
    var self = this;
    return new Promise(function(resolve, reject){
        self.getData(sectionData.sectionUrl).then(function(html){
            var text = self.parseNovelSection(html);
            if(text){
                resolve(text);
            } else {
                self.errorLog.error('解析失败', sectionData.sectionName, sectionData.sectionUrl);
                reject();
            }
        }, function(msg){
            self.errorLog.error('获取失败',sectionData.sectionUrl, msg);
            reject();
        })
    })
}
proto.concatBook = function(){
    var self = this;
    var writeStream = fs.createWriteStream(this.path+'/全本.txt');
    this.successLog.trace('开始合并');
    function concat(n){
        var bookName = self.novelData[n].bookName;
        var readStream = fs.createReadStream(self.path+'/'+bookName+'.txt');
        readStream.on('end', function(){
            self.successLog.info('合并成功', bookName);
            n++;
            if(self.novelData[n]){
                concat(n);
            } else {
                self.successLog.info('全部合并成功');
            }
        })
        readStream.pipe(writeStream, {end: false})
    }
    concat(0);
}

// proto.getData = function(url){
//     return new Promise(function(resolve, reject){
//         var data = [];
//         http.get(url, function(res){
//             res.setEncoding('utf8');
//             res.on('data', function(chunk){
//                 console.log(chunk)
//                 data.push(chunk);
//             }).on('end', function(){
//                 if(res.statusCode != 200){
//                     reject(res.statusCode);
//                 } else {
//                     resolve(data.join(''));
//                 }
//             })
//         }).on('error', function(e){
//             reject(e.message);
//         })
//     })
// }
proto.getData = function(url){
    var self = this;
    return new Promise(function(resolve, reject){
        request({
            url: url,
            encoding: null
        }, function(error, response, body){
            if(error){
                reject(url, error);
            }
            if(response.statusCode != 200){
                reject(url, response.statusCode)
            }
            try{
                var buffer = body;
                if(response.headers['content-encoding'] == 'gzip'){
                    buffer = zlib.gunzipSync(body);
                }
                var encoding = charset(response.headers, buffer);
                resolve(iconv.decode(buffer, encoding))
            } catch(e){
                reject(url, e)
            }
        })
    })
}

module.exports = NovelSpider