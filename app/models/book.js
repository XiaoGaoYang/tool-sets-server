const mongoose = require('mongoose');
// const validate = requie('mongoose-validator');

const Schema = mongoose.Schema;

const Book = new Schema({
  "detail": { type: String, index: {unique: true,dropDups: true} },
  "name": { type: String, required: true },
  "author": { type: String, required: true },
  "publiser": { type: String, required: true },
  "number": { type: String, required: true },
  "cover": { type: String }
});

Book.statics.queryBook = function*(keyword){
  
}

module.exports = mongoose.model('Book',Book);

/*
"bookList": [{
    "detail": "0000430094",
    "name": "CSS商业网站布局之道",
    "author": "朱印宏著",
    "publiser": "清华大学出版社 2007",
    "number": "TP393.092/Z-919.2",
    "type": "中文图书",
    "cover": "https://img3.doubanio.com/mpic/s3022312.jpg"  // 当没有查到封面的时候没有该属性
  }]
  */