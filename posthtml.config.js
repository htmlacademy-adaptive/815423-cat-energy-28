const { getPosthtmlBemLinter } = require('posthtml-bem-linter');
const minifyHtml = require('htmlnano');

const devMode = process.env.NODE_ENV === 'development';

const getSourceName = (filename) => filename.replace(/^.*pages(\\+|\/+)(.*)\.twig$/, '$2').replace(/\\/g, '/');

const plugins = [
  getPosthtmlBemLinter({
    getSourceName,
  }),
];

if (!devMode) {
  plugins.push(minifyHtml({ collapseWhitespace: 'aggressive', minifySvg: false, minifyCss: false }));
}

module.exports = {
  plugins,
};
