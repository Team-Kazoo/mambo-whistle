/**
 * Vitest 配置文件
 * Phase 3: 模块化重构 - 测试框架配置
 *
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试环境: happy-dom (轻量级 DOM 模拟,比 jsdom 快 2-3 倍)
    environment: 'happy-dom',

    // 全局 API (describe, it, expect 等无需导入)
    globals: true,

    // 测试文件匹配模式
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],

    // 排除文件
    exclude: [
      'node_modules',
      'dist',
      'archive',
      '.git'
    ],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'js/**/*.js'
      ],
      exclude: [
        'js/**/*.test.js',
        'js/**/*.spec.js',
        'js/vendor/**',
        'js/lib/**'
      ],
      // 覆盖率阈值
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40
      }
    },

    // 测试超时 (毫秒)
    testTimeout: 10000,

    // Hook 超时
    hookTimeout: 10000,

    // 并发运行测试
    pool: 'threads',

    // 监视模式配置
    watch: false,

    // 报告器
    reporters: ['verbose'],

    // 静默模式 (减少输出)
    silent: false,

    // UI 模式默认关闭；如需可视化运行使用 `npm run test:ui` 或 `vitest --ui`
    ui: false
  },

  // 解析配置
  resolve: {
    alias: {
      '@': '/js',
      '@core': '/js/core',
      '@managers': '/js/managers',
      '@utils': '/js/utils',
      '@config': '/js/config'
    }
  }
});
