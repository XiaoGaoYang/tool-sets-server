const cheerio = require('cheerio');
const superagent = require('superagent');
const fs = require('co-fs');
const co = require('co');

const Book = require('../models/book');
const Keyword = require('../models/keyword');

function bookSpider(keyword){
  co(function*(){
    const kw = yield Keyword.findByKw(keyword);
    if(kw.status !== 'ready') {console.log('相同请求，忽略');return;};
    
    kw.status = 'pending';
    yield kw.save();

    let bookList = [];
    bookList = yield queryBook(keyword);
    console.log('目录页爬取回来有'+bookList.length+'本');

    // 如果跟以前爬取的结果数目是否相同，并且没有错误标记，则直接结束
    if (kw.number === bookList.length && !kw.haserr) {
      kw.status = 'ready';
      yield kw.save();
      console.log('以前爬过，忽略');
      return;
    }

    // 记录新爬去的结果数目，错误标记为false
    kw.number = bookList.length;
    kw.haserr = false;
    yield kw.save();

    // 去重
    bookList = yield deleteRepeat(bookList);
    const len = bookList.length;
    console.log('去重后剩余'+len+'本书');
    
    // 针对新增加的书爬详情页
    bookList = yield queryDetail(bookList);
    console.log('详情页爬取回来有'+bookList.length+'本');
    
    // 根据详情页结果长度是否与去重后的长度相同判断爬详情页时是否有错误发生
    if(bookList.length !== len){
      kw.haserr = true;
      kw.save();
    }

    // 爬豆瓣API
    bookList = yield queryDouBan(bookList);
    console.log('豆瓣爬数据完成');

    //console.log(bookList);
    // bookList = testData;

    // 保存到数据库里
    try{
      yield Book.saves(bookList);
      kw.status = 'ready';
      kw.save();
      console.log('保存数据库完成，新增'+bookList.length+'条数据');
    }catch(err){
      kw.haserr = true;
      kw.status = 'ready';
      kw.save();
      console.log('保存到数据库中发生错误，可能是因为数据库中有重复的数据，用户搜索关键字为：',keyword);
    }
    
  });
}

// 爬取书籍信息
function* queryBook(keyword){
  let totalBook = [];
  const firstPage = yield sendRequest(keyword);
  totalBook = totalBook.concat(firstPage[0]);
  
  let reqArr = [];
  for(let i=2;i<=firstPage[1];i++){
    reqArr.push(sendRequest(keyword,i));
  }
  const bookListArr = yield reqArr; // 并发发送请求
  for(let i=0;i<reqArr.length;i++){
    totalBook = totalBook.concat(bookListArr[i][0]);
  }

  return totalBook;
}

function* sendRequest(keyword,page = 1){
  // 本地测试
  /*
  var data = yield fs.readFile('./test.html', 'utf-8');
  var $ = cheerio.load(data,{decodeEntities: false});
  */
  // console.log('爬取第'+page+'页');
  // 实际使用
  const url = 'http://121.248.104.139:8080/opac/search_adv_result.php?sType0=02&q0=' + encodeURI(keyword) + '&page='+page;
  const res = yield superagent.get(url)
    .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
    .set('Accept-Encoding', 'gzip, deflate, sdch')
    .set('Accept-Language', 'zh-CN,zh;q=0.8')
    .set('Cache-Control', 'max-age=0')
    .set('Connection', 'keep-alive')
    .set('Cookie','safedog-flow-item=AAA8B70150DF46CDAE4B28D75E197AC7; PHPSESSID=67trl7fsious1cbti66ed46co5')
    .set('Host', '121.248.104.139:8080')
    .set('Referer', 'http://lib.cumt.edu.cn/')
    .set('Upgrade-Insecure-Requests', '1')
    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.89 Safari/537.36');

  const $ = cheerio.load(res.text, {decodeEntities: false});
  let bookList = [];
  let totalPage = 1;

  const aBooks = $('#result_content').find('tr');
  if(aBooks.length === 1) return [bookList,totalPage]; // 没有查到书籍，直接返回默认值
  if(page === 1){ // 只有为第一页时才取总页数
    totalPage = $('.numstyle').find('font').eq(1).html();
  }
  bookList = getBookInfo(aBooks);
  return [bookList,totalPage];
}

// 获取图书信息
function getBookInfo(aBooks) {
  let bookList = [];
  for (let i = 1; i < aBooks.length; i++) {
    let bookObj = {}; // 存放书籍信息的对象
    const aTds = aBooks.eq(i).find('td');
    const oBook = aTds.eq(1).find('a');
    // 获取书籍详情页地址
    bookObj.detail = oBook.attr('href').substring(17);
    // 获取书籍名
    bookObj.name = handleBook(oBook.html());
    // 获取责任者
    bookObj.author = aTds.eq(2).html();
    // 获取出版信息
    bookObj.publiser = aTds.eq(3).html();
    // 获取索书号
    bookObj.number = aTds.eq(4).html();
    // 将书籍信息对象push入书籍列表里
    bookList.push(bookObj);
  }
  return bookList;
}

// 从arr中删除本地数据库已经有的图书
function* deleteRepeat(arr) {
  for (let i = 0; i < arr.length; i++) {
    const exist = yield Book.findByDetail(arr[i].detail);
    if(exist) {
      arr.splice(i,1);
      i--;
    }
  }
  return arr;
}

function* queryDetail(arr) {
  /* 不并发
  for (let i = 0; i < arr.length; i++) {
    const obj = yield detailRequest(arr[i].detail);
    Object.assign(arr[i],obj);
  }
  return arr;
  */
  // 控制并发个数
  let reqArr = [];
  let resArr = [];
  const max = 2;  // 最多同时并发请求个数
  for(let i=0;i<arr.length;i++){
    reqArr.push(detailRequest(arr[i].detail));
    // 当达到最大并发请求限制时开始发送请求
    if(reqArr.length === max){
      let res = yield reqArr;
      reqArr = [];
      for(let j=0;j<max;j++){
        resArr.push(res[j]);
      }
    }
  }

  if(reqArr.length){
    let res = yield reqArr;
    for(let j=0;j<reqArr.length;j++){
      resArr.push(res[j]);
    }
  }

  for(let i=0;i<resArr.length;i++){
    if(resArr[i].done){ // 某本书详情页信息爬取成功，合并对象
      Object.assign(arr[i],resArr[i].info);
    }else{  // 某本书详情页信息爬取失败，从arr和resArr将该书删除
      console.log('因为detail为的'+resArr[i].detail+'详情页爬取失败,从上一步爬取结果数组中将该书删除');
      resArr.splice(i,1);
      arr.splice(i,1);
      i--;
    }
  }
  return arr;
}

function* detailRequest(detail){
  const url = 'http://121.248.104.139:8080/opac/item.php?marc_no='+detail;
  let res = '';
  try{
    res = yield superagent.get(url)
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
      .set('Accept-Encoding', 'gzip, deflate, sdch')
      .set('Accept-Language', 'zh-CN,zh;q=0.8')
      .set('Cache-Control', 'max-age=0')
      .set('Connection', 'keep-alive')
      .set('Cookie','safedog-flow-item=AAA8B70150DF46CDAE4B28D75E197AC7; PHPSESSID=67trl7fsious1cbti66ed46co5')
      .set('Host', '121.248.104.139:8080')
      .set('Referer', 'http://lib.cumt.edu.cn/')
      .set('Upgrade-Insecure-Requests', '1')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.89 Safari/537.36');
  }catch(err){
    console.log('获取detail为'+detail+'的详情页出错');
    return {done:false,detail:detail};
  }
  const $ = cheerio.load(res.text);
  const info = {
    isbn: '',
    place: ''
  };

  const str = $('#item_detail').find('dl').eq(2).find('dd').text();
  let isbn = parseInt( str.split('/')[0].split('-').join('') ).toString();
  if(isbn.length < 10){
    info.isbn = '';
  }else{
    info.isbn = isbn;
  }
  const aBook = $('table').eq(0).find('tr');

  let pArr = []
  for(let i=1;i<aBook.length;i++){
    const text = aBook.eq(i).find('td').eq(3).text();
    pArr.push(aBook.eq(i).find('td').eq(3).text().trim());
  }
  info.place = pArr.toString();
  return {done:true,info:info};
}

function* queryDouBan(arr){
  // 控制并发个数
  let reqArr = [];
  let resArr = [];
  const max = 2;  // 最多同时并发请求个数
  for(let i=0;i<arr.length;i++){
    reqArr.push(doubanApi(arr[i].isbn));
    if(reqArr.length === max){
      let res = yield reqArr;
      reqArr = [];
      for(let j=0;j<max;j++){
        resArr.push(res[j]);
      }
    }
  }

  if(reqArr.length){
    res = yield reqArr;
    for(let j=0;j<reqArr.length;j++){
      resArr.push(res[j]);
    }
  }
  for(let i=0;i<arr.length;i++){
    Object.assign(arr[i],resArr[i]);
  }
  return arr;
}

function* doubanApi(isbn){
  if(!isbn) return {};
  const url = 'https://api.douban.com/v2/book/isbn/' + isbn;
  try{
    let res = yield superagent.get(url)
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
      .set('Accept-Encoding', 'gzip, deflate, sdch, br')
      .set('Accept-Language', 'zh-CN,zh;q=0.8')
      .set('Cache-Control', 'max-age=0')
      .set('Connection', 'keep-alive')
      .set('Cookie','bid=9qwCHiHryu0; __utma=30149280.717767427.1475419614.1475453505.1476969828.3; __utmz=30149280.1476969828.3.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); gr_user_id=122e2c4e-dbb9-46e9-9739-f4ada10efdf1; gr_session_id_22c937bbd8ebd703f2d8e9445f7dfd03=c9e3d2c9-03c8-4ded-8fbb-e0de88655a48; gr_cs1_c9e3d2c9-03c8-4ded-8fbb-e0de88655a48=user_id%3A0; _vwo_uuid_v2=ADC3DBEC0C3630BBE808BEAA8EA9B393|f3a416fa5282284e50e5a502ebb74989')
      .set('Host', 'api.douban.com')
      .set('Upgrade-Insecure-Requests', '1')
      .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36');
    res = JSON.parse(res.text);
    return {
      cover: res.image,
      pages: res.pages,
      summary: res.summary,
      price: res.price,
      pubdate: res.pubdate,
    }
  }catch(err){
    console.log('在豆瓣查询isbn为'+isbn+'的图书发生错误');
    console.warn(err);
    return {};
  }
}

// 处理书名，删掉不必要的字符
function handleBook(bookname) {
  var temp = bookname.split('=')[0].trim();
  if (temp.lastIndexOf('.') === temp.length - 1 || temp.lastIndexOf('/') === temp.length - 1) {
    temp = temp.substring(0, temp.length - 1).trim();
  }
  return temp;
}

module.exports = bookSpider;

const testData = [
{
  detail: '0000277361',
  name: 'Angular momentum in quantum mechanics',
  author: 'Edmonds, A.R.',
  publiser: 'Pinceton University Press, 1957.',
  number: 'O413.1/E:24',
  isbn: '',
  place: '南湖外文图书阅览室'
},
{
  detail: '0000277362',
  name: 'Notes on the quantum theory of angular momentum',
  author: 'Feenberg, E.',
  publiser: 'Addison-Wesley Publishing Company, Inc., 1953.',
  number: 'O413.1/F:295',
  isbn: '',
  place: '南湖外文图书阅览室,南湖外文图书阅览室'
}, /*
{
  detail: '0000703307',
  name: 'AngularJS权威教程',
  author: '(美) Ari Lerner著',
  publiser: '人民邮电出版社 2014',
  number: 'TP312JA/L-541',
  isbn: '9787115366474',
  place: '南湖科技书阅览室,南湖科技书阅览室,文昌科技书阅览室',
  cover: 'https://img3.doubanio.com/mpic/s27371732.jpg',
  pages: '476',
  summary: '本书是资深全栈工程师的代表性著作，由拥有丰富经验的国内AngularJS技术专家执笔翻译，通俗易懂、全面深入，是学习AngularJS不可错过的经典之作。无论是出于工作需要，还是好奇心的驱使，只要你想彻底理解AngularJS，本书都会让你感到满意。\n本书将涵盖AngularJS的如下概念。\n双向数据绑定\n依赖注入\n作用域\n控制器\n路由\n客户端模板\n服务\n通过XHR实现动态内容\n测试\n过滤器\n定制表单验证\n深度测试\n定制指令\n专业工具\n对IE的支持',
  price: '99.00元',
  pubdate: '2014-8'
}, 
{
  detail: '0000710338',
  name: '精通AngularJS',
  author: '(美) Pawel Kozlowski, Peter Bacon Darwin著',
  publiser: '华中科技大学出版社 2014',
  number: 'TP312JA/K-983',
  isbn: '9787568003964',
  place: '南湖科技书阅览室,南湖科技书阅览室,南湖科技书阅览室,文昌科技书阅览室',
  cover: 'https://img1.doubanio.com/mpic/s27508138.jpg',
  pages: '368',
  summary: 'AngularJS诞生于Google，已用于开发多款Google产品。它是一套JavaScript前端框架，用于开发当下流行的以数据驱动的单页面Web应用。其核心特性是：MVC、模块化、自动双向数据绑定、语义化标签、依赖注入等。《精通AngularJS》深入浅出地讲解了AngularJS的开发概念和原理，并通过丰富的开发实例向读者展示了构建复杂应用的完整过程，包括学习使用AngularJS特有的基于DOM的模板系统，实现复杂的后端通信，创建漂亮的表单，制作导航，使用依赖注入系统，提高Web应用的安全性，使用Jasmine开展单元测试，等等。',
  price: '79.00',
  pubdate: '2014-11-1'
}, 
{
  detail: '0000759922',
  name: 'Node.js+MongoDB+AngularJS Web开发',
  author: '(美) Brad Dayley著',
  publiser: '电子工业出版社 2015',
  number: 'TP312JA/D-476',
  isbn: '9787121261176',
  place: '南湖科技书阅览室,南湖科技书阅览室,南湖科技书阅览室,文昌科技书阅览室',
  cover: 'https://img3.doubanio.com/mpic/s28122220.jpg',
  pages: '592',
  summary: 'Node.js 是一种领先的服务器端编程环境，MongoDB是最流行的NoSQL数据库，而AngularJS 正迅速成为基于MVC的前端开发的领先框架。它们结合在一起使得能够完全用JavaScript 创建从服务器到客户端浏览器的高性能站点和应用程序。\n《Node.js+MongoDB+AngularJS Web开发》为想要将这3 种技术整合到全面的有效解决方案的Web 程序员提供了完整指南。它简洁而清晰地介绍了这3 种技术，然后迅速转到构建几种常见的Web 应用程序上面。\n读者将学会使用Node.js 和MongoDB来建立更具可扩展性的高性能网站，并利用AngularJS 创新的MVC 方法构建更有效的网页和应用程序，以及把这三者结合在一起使用，从而提供卓越的下一代Web解决方案。\n《Node.js+MongoDB+AngularJS Web开发》适合对HTML 的基础知识已经有所了解，并可以用现代编程语言完成一些编程的读者。读者如果对JavaScript 有一定了解，则将更易于理解本书的内容。',
  price: '108.00元',
  pubdate: '2015-6'
}*/]