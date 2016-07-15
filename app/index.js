var NovelSpider = require('./noverSpider');




var spider = new NovelSpider({
    startUrl: 'http://miaojiangdaoshi.513gp.org/244.html',
    novelName: '苗疆道事',
    bookName: '第一卷 饥饿年代',
    parseData: function(data){
        return {
            code: 200,
            text: data,
            nextUrl: ''
        }
    }
});
spider.start();