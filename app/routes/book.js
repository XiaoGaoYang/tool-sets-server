const router = require('koa-router')();

const { baseApi } = require('../config');
const { index,library } = require('../controllers/book');

const api = 'book';

router.prefix(`/${baseApi}/${api}`);

router.get('/index',index);
router.post('/library',library);

module.exports = router;