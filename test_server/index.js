'use strict';

const express = require('express');
const body = require('body-parser');
const cookie = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const app = express();

app.use(morgan('dev')); // логирование http запросов в консоль

const { createProxyMiddleware } = require('http-proxy-middleware');
app.use(
    createProxyMiddleware({
        target: 'http://212.233.96.54:8080',
        changeOrigin: true,
        pathFilter: '/api'
    })
);

// Раздача статических файлов (это типо nginx должен делать на беке?)
app.use(express.static(path.resolve(__dirname, '..', 'src')));
app.use(express.static(path.resolve(__dirname, '..', 'node_modules'))); // доступ ко всем пакетам
app.use(express.static(path.resolve(__dirname, 'images')));
app.use(body.json());
app.use(cookie());

app.get('/{*path}', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../src/app/index.html'));
});

// eslint-disable-next-line no-unused-vars
const images = [
    {
        src: '/image-1.jpeg'
    },
    {
        src: '/image-1378.jpeg'
    },
    {
        src: '/image-1379.jpeg'
    },
    {
        src: '/image-1380.jpeg'
    }
];

// eslint-disable-next-line no-unused-vars
const users = {
    q: {
        email: 'q@mail.ru',
        password: 'q'
    }
};

const port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log(`Server listening port ${port}`);
});
