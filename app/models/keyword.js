const mongoose = require('mongoose');
// const validate = requie('mongoose-validator');

const Schema = mongoose.Schema;
const Keyword = new Schema({
  // 关键字
  "keyword": { type: String, required: true, index: {unique: true} },
  // 关键字搜索次数
  "count": { type: Number, default: 1,  },
  // 根据该关键字在图书馆搜索到的图书数目
  "number": { type: Number, default: 0 },
  // 记录是否正在爬取该关键字
  "status": { type: String, default: 'ready' },
  // 爬取过程中有没有错误发生
  "haserr": { type: Boolean, default: false },
});

// 更新搜索次数
Keyword.statics.updateCount = function*(kw){
  const exist = yield this.findOne({keyword:kw});
  if(exist){
    exist.count++;
    yield exist.save();
  }else{
    const kwe = new this({keyword:kw});
    yield kwe.save();
  }
}

// 通过关键字来查找
Keyword.statics.findByKw = function*(kw){
  return yield this.findOne({keyword:kw});
}

module.exports = mongoose.model('Keyword',Keyword);
