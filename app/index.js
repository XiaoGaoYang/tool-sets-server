const koa = require('koa');

const routing = require('./routes/');
const { port,mongodb } = require('./config');

const app = new koa();

app.jsonSpaces = 0;

routing(app);

app.listen(port, () => console.log(`The server is running at http://localhost:${port}/`));

/*
var koa = require('koa');
var router = require('koa-router')();
var send = require('koa-send');
var parse = require('co-body');

var queryBook = require('./modules/queryBook');

var app = koa();

// 输入框路由,测试用
router.get('/public/index.html', function *(next) {
  yield send(this,this.path,{root:__dirname});
});

// 图书馆书籍查询路由
router.post('/library',function *(next){
  var body = yield parse(this,{ limit: '1kb' });
  if(body.keyword){
    console.log(body.keyword);
    this.status = 200;
    var data = yield queryBook(body.keyword);
    console.log('处理完成');
    this.body = data;
  }else{
    this.status = 404;
    this.body = {
      err: '发送参数不正确'
    };
  }
});

// 使用路由中间件
app
  .use(router.routes())
  .use(router.allowedMethods());


// 监听端口
app.listen(3000);

console.log('listening on port 3000');
*/