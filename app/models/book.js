const mongoose = require('mongoose');
// const validate = requie('mongoose-validator');

const Schema = mongoose.Schema;
const Book = new Schema({
  "name": { type: String, required: true },
  "number": { type: String, required: true },
  "isbn": { type: String },
  "detail": { type: String, required: true, index: {unique: true} },
  "place": { type: String },
  "author": { type: String, required: true },
  "publiser": { type: String, required: true },
  "cover": { type: String },
  "price": { type: String },
});

// 保存图书--单本
Book.statics.save = function*(obj){
  const book = new this(obj);
  const exists = yield this.findOne({detail: obj.detail});
  if(exists) return {done: false,data:'已经存在'};
  const back = yield book.save();
  if(back) return {done: true,data: back};
}

// 保存图书--多本
Book.statics.saves = function*(arr){
  const back = yield this.collection.insert(arr);
  if(back) return { done:true,data: back }
  return { done:false }
}

// 根据name进行模糊搜索
Book.statics.fuzzyName = function*(keyword){
  return yield this.find({ name: new RegExp(keyword,'i') });
}

Book.statics.findByDetail = function*(detail){
  return yield this.findOne({ detail: detail });
}

module.exports = mongoose.model('Book',Book);