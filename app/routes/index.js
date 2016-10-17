const book = require('./book');

const routes = [book];

module.exports=function(app){
  routes.forEach((route)=>{
    app
      .use(route.routes())
      .use(route.allowedMethods({throw: true}))
  });
}