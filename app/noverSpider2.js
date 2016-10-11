var http = require('http');
var extend = require('./extend');
var log4js = require('log4js');
var mkdirp = require('mkdirp');
var fs = require('fs');

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

    this.successLogger = null;
    this.netErrorLogger = null;
    this.parseErrorLogger = null;
}

var proto = NovelSpider.prototype;
proto.start = function(){
    mkdirp.sync('../novels/'+this.novelName+'/logs');
    log4js.configure({
        appenders: [
            {type: 'file', filename: '../novels/'+ this.novelName +'/logs/success.log', category: 'success'},
            {type: 'file', filename: '../novels/'+ this.novelName +'/logs/netError.log', category: 'netError'},
            {type: 'file', filename: '../novels/'+ this.novelName +'/logs/parseError.log', category: 'parseError'}
        ]
    });
    this.successLogger = log4js.getLogger('success');
    this.netErrorLogger = log4js.getLogger('netError');
    this.parseErrorLogger = log4js.getLogger('parseError');
    this.getNovelData();

}
proto.getNovelData = function(){
    var self = this;
    this.getData(this.novelUrl).then(function(html){
        self.novelData = self.parseNovelData(html);
        if(!self.novelData || self.novelData.length<=0){
            self.parseErrorLogger.error(self.novelUrl)
        } else {
            self.successLogger.trace(self.novelUrl);
            self.spideNovel();
        }
    }, function(msg){
        self.netErrorLogger.error(self.novelUrl, msg);
    })
}
proto.spideNovel = function(){

    var self = this;
    var bookData = this.novelData.shift();
    if(!bookData) return;
    this.spideBook(bookData).then(function(bookText){
        self.writeBook(bookData.bookName, bookText);
        self.spideNovel();
    }, function(){
        self.spideNovel()
    })
}
proto.spideBook = function(bookData){
    var self = this;
    return new Promise(function(resolve, reject){
        var text = '';
        var sections = bookData.bookSections;
        function spideSection(){
            var section = sections.shift();
            if(section){
                self.spideSection(section).then(function(sectionText){
                    text += ('## '+section.sectionName+'\r\n'+sectionText+'\r\n');
                    spideSection();
                }, function(){
                    reject();
                })
            } else {
                resolve(text);
            }
        }
        spideSection();
    })
}
proto.spideSection = function(sectionData){
    var self = this;
    return new Promise(function(resolve, reject){
        self.getData(sectionData.sectionUrl).then(function(html){
            var text = self.parseNovelSection(html);
            if(text){
                self.successLogger.trace(sectionData.sectionUrl, sectionData.sectionName);
                console.log(sectionData.sectionName, sectionData.sectionUrl);
                resolve(text);
            } else {
                self.parseErrorLogger.error(sectionData.sectionUrl, sectionData.sectionName);
                console.log('parseError', sectionData.sectionUrl, sectionData.sectionName);
                reject();
            }
        }, function(msg){
            self.netErrorLogger.error(sectionData.sectionUrl, msg)
            console.log('netError', sectionData.sectionUrl, msg)
            reject();
        })
    })
}
proto.writeBook = function(bookName, bookText){
    var self = this;
    fs.writeFile('../novels/'+this.novelName+'/'+bookName+'.txt', '# '+bookName+'\r\n'+bookText, function(err){

        console.log(self.novelName+'---'+bookName+' success');
    })
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