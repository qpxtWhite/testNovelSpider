var NovelSpider = require('./noverSpider2');
var cheerio = require('cheerio');



var spider = new NovelSpider({
    novelName: '苗疆蛊事',
    novelUrl: 'http://www.miaojianggushi.com/miao-jiang-gu-shi',
    parseNovelSection: function(data){
        try{
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var textdom = $('.wrapper .entry-content p');
            var text = ''
            textdom.each(function(ix, dom){
                text+=$(dom).html().replace(/(<br>)+/g, '\r\n')+'\r\n';
            })
            var $$ = cheerio.load('<div>'+text+'</div>');
            $$('script').remove();
            text = $$('div').text();
            return text;
        } catch(e){

        }
    },
    parseNovelData: function(data){
        try{
            var novel = [];
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var domBook = $('#content .page-content>h2');
            domBook.each(function(ix, domTitle){
                var book = {bookName: $(domTitle).text().replace(/^.*?\s/,''), bookSections: []};
                var domSection = $(domTitle).next().find('li a');
                domSection.each(function(ix, domLink){
                    book.bookSections.push({sectionName:$(domLink).text(), sectionUrl: $(domLink).attr('href')})
                })
                novel.push(book);
            })
            return novel;
        } catch(e){}
    }
});
spider.start();