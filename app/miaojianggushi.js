var NovelSpider = require('./noverSpider');
var cheerio = require('cheerio');



var spider = new NovelSpider({
    startUrl: 'http://www.miaojianggushi.com/285.html',
    endUrl: 'http://www.miaojianggushi.com/304.html',
    novelName: '苗疆蛊事',
    bookName: '第十一卷 明珠叙事',
    parseData: function(data, url){
        try{
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var title = $('.entry-header .single-title span').text().replace(/^.*?\s/,'');
            var textdom = $('.wrapper .entry-content p');
            var text = ''
            textdom.each(function(ix, dom){
                text+=$(dom).html().replace(/(<br>)+/g, '\r\n')+'\r\n';
            })
            var $$ = cheerio.load('<div>'+text+'</div>');
            $$('script').remove();
            text = $$('div').text();
            var nextUrl = $('.wrapper .nav-single .nav-next a').attr('href');
            console.log(title, url);
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