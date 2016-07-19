var NovelSpider = require('./noverSpider');
var cheerio = require('cheerio');



var spider = new NovelSpider({
    startUrl: 'http://miaojiangdaoshi.513gp.org/1297.html',
    novelName: '苗疆道事',
    bookName: '终卷 一个时代的结束，一个时代的开端',
    parseData: function(data){
        try{
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var title = $('.chaptertitle h1').text()
            var text = $('.bookcontent').html().replace(/(<br>)+/g, '\r\n');
            text = cheerio.load('<div>'+text+'</div>')('div').text();
            var nextUrl = $('.bottomlink .linkbtn a').eq(2).attr('href');
            console.log(title, nextUrl)
            return {
                code: 200,
                text: '\r\n## '+title+'\r\n'+text,
                nextUrl: nextUrl
            }
        } catch(e){
            return {
                code: 0,
                msg: e.message
            }
        }
    }
});
spider.start();