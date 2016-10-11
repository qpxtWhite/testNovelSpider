var NovelSpider = require('./noverSpider3');
var cheerio = require('cheerio');



var spider = new NovelSpider({
    novelName: '苗疆蛊事2',
    novelUrl: 'http://www.miaojianggushi2.com/',
    parseNovelSection: function(data){
        try{
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var textdom = $('.post_entry p');
            var text = [];
            textdom.each(function(ix, p){
                text.push($(p).html().replace(/(^\s*)|(\s*$)/g, ""))
            })
            return text.join('\r\n');
        } catch(e){

        }
    },
    parseNovelData: function(data){
        try{
            var novel = [];
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var domBook = $('#content .container');
            domBook.each(function(ix, dom){
                var $dom = $(dom);
                var book = {bookName:$dom.find('.title h2 a').eq(0).text(), bookSections:[]};
                $dom.children('ul').find('li').each(function(ix, li){
                    var $link = $(li).find('a[href]');
                    book.bookSections.push({
                        sectionName: $link.html(),
                        sectionUrl: $link.attr('href')
                    })
                })
                novel.push(book);
            })
            return novel;
        } catch(e){}
    }
});
spider.start();