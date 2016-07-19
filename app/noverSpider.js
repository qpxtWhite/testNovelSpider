var http = require('http');
var extend = require('./extend');
var log4js = require('log4js');
var mkdirp = require('mkdirp');
var fs = require('fs');

var NovelSpider = function(options){
    extend(this, {
        novelName: '',
        bookName: '',
        startUrl: '',
        parseData: function(data){return data}
    }, options || {});
    this.novel = '# '+this.bookName+'\r\n';
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
    // this.spide('http://miaojiangdaoshi.513gp.org/4244.html');
    this.spide(this.startUrl);
}
proto.spide = function(url){
    var self = this;
    this.getData(url).then(function(data){
        var novel = self.parseData(data);

        if(novel.code == 200){
            self.successLogger.trace(url);
            self.novel += novel.text;
        } else {
            self.parseErrorLogger.error(url, novel.msg);
        }

        if(novel.nextUrl && novel.nextUrl!=url){
            self.spide(novel.nextUrl);
        } else {
            self.writeNovel();
        }
    }, function(msg){
        self.netErrorLogger.error(url, msg)
    })
}

proto.writeNovel = function(){
    var self = this;
    fs.writeFile('../novels/'+this.novelName+'/'+this.bookName+'.txt', this.novel, function(){
        console.log(self.novelName+'---'+self.bookName+' success');
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