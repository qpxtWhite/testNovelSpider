var http = require('http');
var extend = require('./extend');
var async = require('async');
var mkdirp = require('mkdirp');
var stream = require('stream');
var fs = require('fs');
var path = require('path');
var colors = require('colors');

function log(type, text){
    var str = '[ '+type+' ]';
    switch(type){
        case log.ERROR:
            str = str.red;
            break;
        case log.SUCCESS:
            str = str.green;
            break;
        default:
            str = str.white;
            break;
    }
    var args = Array.prototype.slice.call(arguments);
    args[0] = str;
    console.log.apply(console, args);
}
log.ERROR = 'ERROR';
log.SUCCESS = 'SUCCESS';
log.NORMAL = 'NORMAL';


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
}

var proto = NovelSpider.prototype;
proto.start = function(){
    mkdirp.sync(this.path);
    this.getNovelData();

}
proto.getNovelData = function(){
    var self = this;
    this.getData(this.novelUrl).then(function(html){
        self.novelData = self.parseNovelData(html);
        if(!self.novelData || self.novelData.length<=0){
            log(log.ERROR, '==》目录解析失败');
        } else {
            log(log.SUCCESS, '==》目录获取成功');
            self.spideNovel();
        }
    }, function(msg){
        log(log.ERROR, '==》目录获取失败', msg);
    })
}
proto.spideNovel = function(){
    var self = this;
    async.mapLimit(this.novelData, 2, function(book, cb){
        self.spideBook(book, cb);
    }, function(){
        self.concatBook();
    });
}
proto.spideBook = function(bookData, cb){
    log(log.NORMAL, '==》开始抓取 ', bookData.bookName);
    var n = 0;
    var section = bookData.bookSections[n];
    var writeStream = fs.createWriteStream(this.path+'/'+bookData.bookName+'.txt');
    var readStream = new stream.Readable();
    readStream._read = function(){};
    writeStream.on('finish', cb);
    readStream.pipe(writeStream);
    readStream.push('# '+bookData.bookName+'\r\n');
    var self = this;
    this.spideSection(section).then(function spideSuccess(text){
        text = ('## '+section.sectionName+'\r\n'+text+'\r\n');
        readStream.push(text);
        n++;
        section = bookData.bookSections[n];
        if(section){
            self.spideSection(section).then(spideSuccess);
        } else {
            log(log.NORMAL, '==》抓取结束 ', bookData.bookName);
            readStream.push(null);
        }
    })
}
proto.spideSection = function(sectionData){
    var self = this;
    return new Promise(function(resolve, reject){
        self.getData(sectionData.sectionUrl).then(function(html){
            var text = self.parseNovelSection(html);
            if(text){
                log(log.SUCCESS, sectionData.sectionName, sectionData.sectionUrl)
                resolve(text);
            } else {
                log(log.ERROR, '==》解析失败', sectionData.sectionName, sectionData.sectionUrl);
                reject();
            }
        }, function(msg){
            log(log.ERROR, '==》获取失败', sectionData.sectionUrl, msg);
            reject();
        })
    })
}
proto.concatBook = function(){
    log(log.NORMAL, '==》开始合并');
    var self = this;
    var writeStream = fs.createWriteStream(this.path+'/全本.txt');
    function concat(n){
        var bookName = self.novelData[n].bookName;
        var readStream = fs.createReadStream(self.path+'/'+bookName+'.txt');
        readStream.on('end', function(){
            log(log.SUCCESS, bookName);
            n++;
            if(self.novelData[n]){
                concat(n);
            } else {
                log(log.NORMAL, '==》合并结束')
            }
        })
        readStream.pipe(writeStream, {end: false})
    }
    concat(0);
}

proto.getData = function(url){
    return new Promise(function(resolve, reject){
        var data = [];
        http.get(url, function(res){
            res.setEncoding('utf8');
            res.on('data', function(chunk){
                data.push(chunk);
            }).on('end', function(){
                if(res.statusCode != 200){
                    reject(res.statusCode);
                } else {
                    resolve(data.join(''));
                }
            })
        }).on('error', function(e){
            reject(e.message);
        })
    })
}

module.exports = NovelSpider