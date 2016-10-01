var cheerio = require('cheerio');
var superagent = require('superagent');
var fs = require('co-fs');

// 查询书籍
function *queryBook(keyword){
  
  var url = 'http://121.248.104.139:8080/opac/search_adv_result.php?sType0=any&q0='+keyword;
  var queryResult = {
    pageNumber: 0,
    bookInfo: {
      booklist: [],
      bookId: [],
      author: [],
      publiser: [],
      callNumber: [],
      type: [],
    }
  };
  var res = yield superagent.get(url);
  var $ = cheerio.load(res.text);
  var aBooks = $('#result_content').find('tr');
  queryResult.pageNumber = $('.numstyle').find('font').eq(1).html();
  for (var i = 1; i < aBooks.length; i++) {
    var aTds = aBooks.eq(i).find('td');
    var oBook = aTds.eq(1).find('a');
    // 获取书籍详情页地址
    queryResult.bookInfo.bookId.push(oBook.attr('href').substring(17));
    // 获取书籍名
    queryResult.bookInfo.booklist.push(oBook.html());
    // 获取责任者
    queryResult.bookInfo.author.push(aTds.eq(2).html());
    // 获取出版信息
    queryResult.bookInfo.publiser.push(aTds.eq(3).html());
    // 获取索书号
    queryResult.bookInfo.callNumber.push(aTds.eq(4).html());
    // 获取文献类型
    queryResult.bookInfo.type.push(aTds.eq(5).html());
  }
  return queryResult;

  // 本地测试
  /*
  var data = yield fs.readFile('test.html', 'utf-8');
  var $ = cheerio.load(data);
  var queryResult = {
    pageNumber: 0,
    bookInfo: {
      booklist: [],
      bookId: [],
      author: [],
      publiser: [],
      callNumber: [],
      type: [],
    }
  };
  var aBooks = $('#result_content').find('tr');
  queryResult.pageNumber = $('.numstyle').find('font').eq(1).html();
  for (var i = 1; i < aBooks.length; i++) {
    var aTds = aBooks.eq(i).find('td');
    var oBook = aTds.eq(1).find('a');
    // 获取书籍详情页地址
    queryResult.bookInfo.bookId.push(oBook.attr('href').substring(17));
    // 获取书籍名
    queryResult.bookInfo.booklist.push(oBook.html());
    // 获取责任者
    queryResult.bookInfo.author.push(aTds.eq(2).html());
    // 获取出版信息
    queryResult.bookInfo.publiser.push(aTds.eq(3).html());
    // 获取索书号
    queryResult.bookInfo.callNumber.push(aTds.eq(4).html());
    // 获取文献类型
    queryResult.bookInfo.type.push(aTds.eq(5).html());
  }
  return queryResult;
  */

}

module.exports = queryBook;