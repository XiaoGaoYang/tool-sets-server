const send = require('koa-send');
const cheerio = require('cheerio');
const superagent = require('superagent');
const fs = require('co-fs');
const parse = require('co-body');
const path = require('path');

// const book = require('../models/book');

const queryBook = require('../utils/queryBook');

// 测试页
exports.index = function*(next){
  yield send(this, '/index.html', { root: path.join(process.cwd(),'/app/views') });
}

// 搜索
exports.library = function*(next) {
  console.log('find');
  const body = yield parse(this, {limit: '1kb'});
  if (body.keyword) {
    console.log(body.keyword);
    this.status = 200;

    const data = yield queryBook(body.keyword);

    console.log('处理完成');
    this.body = data;
  } else {
    this.status = 404;
    this.body = {err: '发送参数不正确'};
  }
}