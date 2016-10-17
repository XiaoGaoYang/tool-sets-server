var cheerio = require('cheerio');
var superagent = require('superagent');
// var thunkify = require('thunkify');
var fs = require('co-fs');

// 查询书籍
function* queryBook(keyword) {
  // 本地测试
  /*
  var data = yield fs.readFile('./test.html', 'utf-8');
  var $ = cheerio.load(data,{decodeEntities: false});
  */

  // 实际使用
  var url = 'http://121.248.104.139:8080/opac/search_adv_result.php?sType0=02&q0=' + encodeURI(keyword);
  var res = yield superagent.get(url)
    .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
    .set('Accept-Encoding', 'gzip, deflate, sdch')
    .set('Accept-Language', 'zh-CN,zh;q=0.8')
    .set('Cache-Control', 'max-age=0')
    .set('Connection', 'keep-alive')
    .set('Host', '121.248.104.139:8080')
    .set('Referer', 'http://lib.cumt.edu.cn/')
    .set('Upgrade-Insecure-Requests', '1')
    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.89 Safari/537.36');
  var $ = cheerio.load(res.text, {decodeEntities: false});

  var queryResult = {
    // code: 0,  // 0 表示成功，其他表示失败
    totalPage: 0,
    currentPage: 0,
    bookList: [],
  };

  var aBooks = $('#result_content').find('tr');
  if(aBooks.length === 1) return queryResult; // 没有查到书籍，直接返回默认值
  // 当前页数
  queryResult.currentPage = $('.numstyle').find('font').eq(0).html();
  // 总页数
  queryResult.totalPage = $('.numstyle').find('font').eq(1).html();
  for (var i = 1; i < aBooks.length; i++) {
    var bookObj = {}; // 存放书籍信息
    var aTds = aBooks.eq(i).find('td');
    var oBook = aTds.eq(1).find('a');
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
    // 获取文献类型
    bookObj.type = aTds.eq(5).html();
    // 将书籍信息对象push入书籍列表里
    queryResult.bookList.push(bookObj);
  }

  var arrList = [];
  for (var i = 0; i < queryResult.bookList.length; i++) {
    arrList.push(bookCover(queryResult.bookList[i].name));
  }
  var aImg = yield arrList; // 并发发起arrList.length个请求
  checkCover(aImg); // 检查封面
  for (var i = 0; i < aImg.length; i++) {
    queryResult.bookList[i].cover = aImg[i];
  }

  return queryResult;

}

// 根据书名从豆瓣爬取图书封面
function* bookCover(bookName) {
  var url = 'https://book.douban.com/subject_search?search_text=' + encodeURI(bookName) + '&cat=1001';
  var res = yield superagent.get(url);
  var $ = cheerio.load(res.text);
  var arrBooks = $('.article').find('.subject-item');
  var imgUrl = arrBooks.eq(0).find('.pic').find('img').attr('src');
  return imgUrl;
}

// 处理书名，删掉不必要的字符，提高豆瓣搜索准确率
function handleBook(bookname) {
  var temp = bookname.split('=')[0].trim();
  if (temp.lastIndexOf('.') === temp.length - 1 || temp.lastIndexOf('/') === temp.length - 1) {
    temp = temp.substring(0, temp.length - 1).trim();
  }
  return temp;
}

// 检查封面
function checkCover(aCover) {
  for (var i = 0; i < aCover.length; i++) {
    // 如果为豆瓣网的默认封面
    // 处理为undefined的，对应的书籍的json数据里将不会有cover属性
    // https://img3.doubanio.com/mpic/s25073924.jpg
    if (aCover[i] && aCover[i].lastIndexOf('book-default-medium.gif') !== -1) aCover[i] = undefined;
  }
  return aCover;
}

/* 头信息
.set('Host','book.douban.com')
.set('Upgrade-Insecure-Requests','1')
.set('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.89 Safari/537.36')
*/
module.exports = queryBook;