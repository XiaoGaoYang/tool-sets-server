const send = require('koa-send');
const parse = require('co-body');
const path = require('path');

const Book = require('../models/book');
const Keyword = require('../models/keyword');

const bookSpider = require('../spider/book');

// 测试页
exports.index = function*(next){
  yield send(this, '/index.html', { root: path.join(process.cwd(),'/app/views') });
}

// 搜索
exports.library = function*(next) {
  const body = yield parse(this, {limit: '1kb'});
  // 没有输入关键字
  if (!body.keyword) {
    this.status = 400;
    this.body = {"msg": 'missing_args'};
    return;
  }
  // lastId参数错误
  if (body.lastId && !body.lastId.match(/^[0-9a-fA-F]{24}$/)) {
    this.status = 404;
    this.body = {"msg": 'book_not_found'};
    return;
  }
  // 在本地数据查找，然后返回给请求方
  console.log('用户搜索关键字为:', body.keyword);
  const dbResult = yield Book.fuzzyName(body.keyword, body.lastId, parseInt(body.count));
  this.status = 200;
  this.body = {"books": dbResult}

  // 更新该关键字的搜索次数
  yield Keyword.updateCount(body.keyword);

  // 根据书名去图书馆爬取书籍，然后与本地数据对比，把本地没有的存入数据库
  bookSpider(body.keyword);
}