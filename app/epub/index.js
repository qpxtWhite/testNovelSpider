var fs = require('fs')


function Epub(options){
    Object.assign(this, {
        src: '',
        dest: ''
    }, options || {})
}
var proto = Epub.prototype;
proto.start = function(){
    fs.readFile(this.src, function(err, data){
        console.log(process.cwd())
    })
}
proto.addParam = function(){}

module.exports = Epub;