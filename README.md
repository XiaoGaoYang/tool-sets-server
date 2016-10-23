# tool-sets-server

`tool-sets`项目的服务器端代码，提供API供客户端调用

后端语言为`Node.js`，使用`Koa`框架，采用`MongoDB`作为数据库

# 图书馆书籍查询

首先获取用户输入关键字，在本地数据库查找，将查找结果返回给客户端，再根据关键字去爬取数据，并与数据库中的数据比较，将数据库中已经有的剔除，然后保存到数据库。

所以，如果查某本书时发现没有相关搜索结果，而图书馆又确实有这本书，此时等几分钟，让爬虫把数据爬回数据库，再进行查找就能查到了。

矿大图书馆书籍查询系统，采用的是后端渲染，不能直接使用API获取数据，所以采取的方法是先获取网页内容，从网页中将需要的数据爬取出来，然后再根据每本书的ISBN，从豆瓣API获取图书的封面，价格，简介等信息。

## API

请求：`POST` `http://localhost:3000/tool-sets/book/library`  

接受参数：

| 参数 | 意义 | 备注 |
| ------ | ------ | ------ |
| keyword | 搜索关键字 | 必填，为用户输入的书名 |
| lastId | 开始位置标记 | 选填，值为上一次返回结果中最后一个的_id属性 |
| count | 返回数量 | 选填，默认返回10条，最大返回100条 |

返回示例：
```javascript
{
  "books": [{
    "_id": "580a2435abb44614f023c032",
    "detail": "0000739966",
    "name": "Head First HTML与CSS.Head first HTML and CSS",
    "author": "Elisabeth Robson, Eric Freeman著",
    "publiser": "中国电力出版社 2013",
    "number": "TP312HT/L-162",
    "isbn": "9787512344778",
    "place": "南湖科技书阅览室,南湖科技书阅览室,文昌科技书阅览室",
    "cover": "https://img3.doubanio.com/mpic/s27104165.jpg",
    "pages": "762",
    "summary": "是不是已经厌倦了那些深奥的HTML书？",
    "price": "98.00元",
    "pubdate": "2013-9"
  }]
}
```
