const cheerio = require('cheerio');
const superagent = require('superagent');
const fs = require('co-fs');
const co = require('co');

const Book = require('../models/book');

function bookSpider(keyword){
  co(function*(){
    // 根据关键字搜索图书
    let bookList = [];
    bookList = yield queryBook(keyword);
    console.log('爬取回来的有'+bookList.length+'本');
    bookList = yield deleteRepeat(bookList);
    console.log('去重后剩余'+bookList.length+'本书');
    bookList = yield queryDetail(bookList);
    console.log('所有的详情页爬取完成');
    bookList = yield queryDouBan(bookList);
    console.log('豆瓣爬数据完成');
    
    // 保存到数据库里
    try{
      const back = yield Book.saves(bookList);
      if(!back.done) console.log('保存到数据库中发生错误，用户搜索关键字为：',keyword);
      console.log('保存数据库完成，新增'+bookList.length+'条数据');
    }catch(err){
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
  console.log('爬取第'+page+'页');
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

function* detailRequest(detail){
  const url = 'http://121.248.104.139:8080/opac/item.php?marc_no='+detail;
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

  const $ = cheerio.load(res.text);
  const info = {
    isbn: '',
    place: ''
  };

  const str = $('#item_detail').find('dl').eq(2).find('dd').text();
  let isbn = parseInt( str.split('/')[0].split('-').join('') ).toString();
  if(isbn.length < 10){
    info.isbn = undefined;
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
  return info;
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
    let res = yield superagent.get(url);
    res = JSON.parse(res.text);
    return {
      cover: res.image,
      pages: res.pages,
      summary: res.summary,
      price: res.price,
      pubdate: res.pubdate,
    }
  }catch(err){
    console.log('查询isbn为'+isbn+'的图书发生错误');
    return {};
  }
}

// 处理书名，删掉不必要的字符，提高豆瓣搜索准确率
function handleBook(bookname) {
  var temp = bookname.split('=')[0].trim();
  if (temp.lastIndexOf('.') === temp.length - 1 || temp.lastIndexOf('/') === temp.length - 1) {
    temp = temp.substring(0, temp.length - 1).trim();
  }
  return temp;
}

module.exports = bookSpider;
