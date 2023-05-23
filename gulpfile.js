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
import include from 'gulp-include';
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
  return compileHtml().pipe(gulp.dest('source'));
};

// Styles

export const styles = () => {
  return gulp
    .src('source/scss/style.scss', { sourcemaps: devMode })
    .pipe(plumber())
    .pipe(include())
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

const images = () =>
  gulp
    .src('source/img/**/*.{jpg,png,svg}')
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
    .pipe(webp({ quality: 75 }))
    .pipe(gulp.dest('build/img'));

// Sprite

const svg = () =>
  gulp
    .src(['source/img/*.svg', '!source/img/icons/*.svg'])
    .pipe(imagemin([svgo(svgoConfig)]))
    .pipe(gulp.dest('build/img'));

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
    .src(['source/fonts/**/*.{woff2,woff}', 'source/*.ico', 'source/*.webmanifest'], {
      base: 'source',
    })
    .pipe(gulp.dest('build'));
};

// Clean

const clean = () => deleteAsync('build');

// Server

const server = (done) => {
  browser.init({
    server: {
      baseDir: 'build',
    },
    cors: true,
    notify: false,
    ui: false,
  });
  done();
};

// Watcher

const watcher = () => {
  gulp.watch(EDITORCONFIG_CHECKS, lintEditorconfig);
  gulp.watch('source/scss/**/*.scss', gulp.series(styles));
  gulp.watch('source/*.html').on('change', browser.reload);
  gulp.watch('source/layouts/**/*.twig', buildHtml);
};

export const lint = gulp.parallel(compileHtml, lintEditorconfig, lintStyles);

export const build = gulp.series(
  clean,
  gulp.parallel(buildHtml, styles, lintEditorconfig, lintStyles, makeStack, svg, copy, images)
);

export default gulp.series(build, server, watcher, svg, copy, makeStack, images);
