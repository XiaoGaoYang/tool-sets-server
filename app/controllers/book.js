const send = require('koa-send');
const parse = require('co-body');
const path = require('path');

const Book = require('../models/book');

const bookSpider = require('../spider/book');

// 测试页
exports.index = function*(next){
  yield send(this, '/index.html', { root: path.join(process.cwd(),'/app/views') });
}

// 搜索
exports.library = function*(next) {
  const body = yield parse(this, {limit: '1kb'});
  if (body.keyword) {
    console.log(body.keyword);

    // 根据书名在本地数据查找，然后返回给请求方
    const localResult = yield Book.fuzzyName(body.keyword);
    this.status = 200;
    this.body = localResult;
    
    // 根据书名去图书馆爬取书籍，然后与本地数据对比，把本地没有的存入数据库
    bookSpider(body.keyword);
  } else {
    this.status = 404;
    this.body = {err: '发送参数不正确'};
  }
}