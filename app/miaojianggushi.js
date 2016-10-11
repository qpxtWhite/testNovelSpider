var NovelSpider = require('./noverSpider3');
var cheerio = require('cheerio');



var spider = new NovelSpider({
    novelName: '苗疆蛊事',
    novelUrl: 'http://www.513gp.org/',
    parseNovelSection: function(data){
        try{
            var $ = cheerio.load(data, {
                decodeEntities: false
            });
            var textdom = $('.bookcontent');
            textdom.find('script').remove();
            var text = textdom.html().replace(/(<br>)+/g, '\r\n');
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
            var domBook = $('.booklist span');
            var book;
            domBook.each(function(ix, span){
                var $span = $(span);
                if($span.hasClass('v')){
                    book = {bookName: $span.html().replace(/(^\s*)|(\s*$)/g, ""), bookSections:[]};
                    novel.push(book);
                } else {
                    book.bookSections.push({sectionName:$span.find('a').html().replace(/(^\s*)|(\s*$)/g, ""), sectionUrl: $span.find('a').attr('href')})
                }
            });
            // return [{
            //     bookName: 'blblb',
            //     bookSections: [{
            //         sectionName: '第一章 外婆和金蚕蛊',
            //         sectionUrl: 'http://www.513gp.org/244.html'
            //     }, {
            //         sectionName: '第三章 山魈野怪，湘黔矮骡子',
            //         sectionUrl: 'http://www.513gp.org/246.html'
            //     }]
            // }, {
            //     bookName: 'aabb',
            //     bookSections: [{
            //         sectionName: '第二章 蛊毒发作，需觅良方',
            //         sectionUrl: 'http://www.513gp.org/245.html'
            //     }]
            // },{
            //     bookName: 'bwew',
            //     bookSections: [{
            //         sectionName: '第二章 蛊毒发作，需觅良方',
            //         sectionUrl: 'http://www.513gp.org/245.html'
            //     }]
            // }]
            return novel;
        } catch(e){}
    }
});
spider.start();