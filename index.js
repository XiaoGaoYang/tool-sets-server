var koa = require('koa');
var router = require('koa-router')();
var send = require('koa-send');
var parse = require('co-body');
var path = require('path');

var queryBook = require('./modules/queryBook');

const host = '127.0.0.1:3000';

var app = koa();

// 输入框路由,测试用
router.get('/public/index.html', function *(next) {
  yield send(this,this.path,{root:__dirname});
});

// 图书馆书籍查询路由
router.post('/library',function *(next){
  var body = yield parse(this,{ limit: '1kb' });
  this.status = 200;
  var data = yield* queryBook(body.keyword);
  this.body = data;
});

// 使用路由中间件
app
  .use(router.routes())
  .use(router.allowedMethods());

// 监听端口
app.listen(3000);

console.log('listening on port 3000');