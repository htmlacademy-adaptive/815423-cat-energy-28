import gulp from 'gulp';
import plumber from 'gulp-plumber';
import sass from 'gulp-dart-sass';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import browser from 'browser-sync';
import getData from 'gulp-data';
import posthtml from 'gulp-posthtml';
import twig from 'gulp-twig';
import lintspaces from 'gulp-lintspaces';
import stylint from 'stylelint';
import postcssReporter from 'postcss-reporter';
import scssSyntax from 'postcss-scss';
import mozJpeg from 'imagemin-mozjpeg';
import pngQuant from 'imagemin-pngquant';
import svgo from 'imagemin-svgo';
import svgoConfig from './svgo.config.js';
import webp from 'gulp-webp';
import imagemin from 'gulp-imagemin';
import { stacksvg } from 'gulp-stacksvg';
import rename from 'gulp-rename';
import { deleteAsync } from 'del';

const devMode = process.env.NODE_ENV === 'development';
const EDITORCONFIG_CHECKS = ['*.{js,json}', 'source/**/*.{twig,js,less,svg}'];

// HTML

const compileHtml = () => {
  return gulp
    .src('source/layouts/pages/**/*.twig')
    .pipe(plumber())
    .pipe(
      getData(({ path }) => {
        const page = path.replace(/^.*pages(\\+|\/+)(.*)\.twig$/, '$2').replace(/\\/g, '/');

        return {
          devMode,
          page,
        };
      })
    )
    .pipe(twig())
    .pipe(gulp.dest('build'))
    .pipe(posthtml());
};

const buildHtml = () => {
  return compileHtml().pipe(gulp.dest('build'));
};

// Styles

export const styles = () => {
  return gulp
    .src('source/scss/style.scss', { sourcemaps: devMode })
    .pipe(plumber())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([autoprefixer()]))
    .pipe(gulp.dest('build/css', { sourcemaps: '.' }))
    .pipe(rename('style.min.css'))
    .pipe(browser.stream());
};

// Lint styles

const lintStyles = () => {
  return gulp.src('source/scss/**/*.scss').pipe(
    postcss(
      [
        stylint(),
        postcssReporter({
          clearAllMessages: true,
          throwError: !devMode,
        }),
      ],
      { syntax: scssSyntax }
    )
  );
};

// Lint editorconfig

const lintEditorconfig = () => {
  return gulp
    .src(EDITORCONFIG_CHECKS)
    .pipe(lintspaces({ editorconfig: '.editorconfig' }))
    .pipe(lintspaces.reporter({ breakOnWarning: !devMode }));
};

// Images

const images = () => {
  return gulp
    .src(['source/img/**/*.{jpg,png,svg}', '!source/img/icons/*.svg'])
    .pipe(
      imagemin([
        svgo(svgoConfig),
        pngQuant({
          speed: 1,
          strip: true,
          dithering: 1,
          quality: [0.8, 0.9],
          optimizationLevel: 3,
        }),
        mozJpeg({ quality: 75, progressive: true }),
      ])
    )
    .pipe(gulp.dest('build/img'));
};

const createWebp = () => {
  return gulp
    .src(['source/img/**/*.{jpg,png}', '!source/img/favicons/*'])
    .pipe(webp({ quality: 75 }))
    .pipe(gulp.dest('build/img'));
};

// Sprite

const makeStack = () => {
  return gulp
    .src('source/img/icons/*.svg')
    .pipe(imagemin([svgo(svgoConfig)]))
    .pipe(stacksvg({ output: `sprite` }))
    .pipe(gulp.dest(`build/img`));
};

// Copy

const copy = () => {
  return gulp
    .src(['source/{fonts,js}/**/*.{woff2,woff,js}', 'source/*.{ico,webmanifest}'], {
      base: 'source',
    })
    .pipe(gulp.dest('build'));
};

// Clean

const clean = () => deleteAsync('build');

// Server

const server = (done) => {
  browser.init({
    server: ['build', 'source'],
    cors: true,
    notify: false,
    ui: false,
  });
  done();
};

// Watcher

const reload = (done) => {
  browser.reload();
  done();
};

const watcher = () => {
  gulp.watch(EDITORCONFIG_CHECKS, lintEditorconfig);
  gulp.watch('source/scss/**/*.scss', styles);
  gulp.watch('source/layouts/**/*.twig', gulp.series(buildHtml, reload));
  gulp.watch(['source/img/**/*.{jpg,png}', '!source/img/favicons/*'], gulp.series(createWebp, reload));
  gulp.watch('source/img/icons/*.svg', gulp.series(makeStack, reload));
};

export const lint = gulp.parallel(compileHtml, lintEditorconfig, lintStyles);


export const compile = gulp.series(
  clean,
  gulp.parallel(buildHtml, styles, lintEditorconfig, lintStyles, makeStack, createWebp)
);

export const build = gulp.series(compile, images, copy);

export default gulp.series(compile, server, watcher);
