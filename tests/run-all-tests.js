#!/usr/bin/env node

/**
 * Phase 2.10: 测试运行器
 *
 * 统一运行所有 Phase 2 单元测试并生成报告
 *
 * 使用方式:
 *   node tests/run-all-tests.js
 *   npm test
 *
 * 输出:
 *   - 控制台: 彩色测试报告
 *   - 文件: docs/phase2/PHASE2_TEST_REPORT.md (可选)
 *
 * @author Claude Code
 * @version 1.0.0
 * @date 2025-01-01
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// 测试套件配置
const testSuites = [
    {
        name: 'Phase 2.3: 平滑滤波器',
        file: 'smoothing-filters.test.js',
        phase: '2.3',
        description: 'Kalman/EMA/Median 滤波器'
    },
    {
        name: 'Phase 2.4: 起音检测器',
        file: 'onset-detector.test.js',
        phase: '2.4',
        description: 'OnsetDetector 状态机'
    },
    {
        name: 'Phase 2.4补充: 音频工具库',
        file: 'audio-utils.test.js',
        phase: '2.4补充',
        description: 'AudioUtils (RMS/Peak/ZCR 等)'
    },
    {
        name: 'Phase 2.5: 频谱特征提取',
        file: 'spectral-features.test.js',
        phase: '2.5',
        description: 'SpectralFeatures (亮度/气声)'
    },
    {
        name: 'Phase 2.6: 表现力特征集成',
        file: 'expressive-features.test.js',
        phase: '2.6',
        description: 'ExpressiveFeatures 完整管线'
    },
    {
        name: 'Phase 2.10: 配置系统集成',
        file: 'config-integration.test.js',
        phase: '2.10',
        description: '端到端配置集成测试'
    }
];

/**
 * 运行单个测试文件
 */
async function runTest(suite) {
    const testPath = join(__dirname, suite.file);

    return new Promise((resolve) => {
        const startTime = Date.now();

        console.log(`\n${colors.cyan}▶ 运行测试: ${suite.name}${colors.reset}`);
        console.log(`${colors.dim}  文件: ${suite.file}${colors.reset}`);
        console.log(`${colors.dim}  描述: ${suite.description}${colors.reset}`);

        const child = spawn('node', [testPath], {
            stdio: 'inherit',
            cwd: dirname(__dirname)
        });

        child.on('close', (code) => {
            const duration = Date.now() - startTime;

            const result = {
                suite: suite.name,
                phase: suite.phase,
                file: suite.file,
                passed: code === 0,
                duration,
                exitCode: code
            };

            if (code === 0) {
                console.log(`${colors.green}✓ 通过${colors.reset} (${duration}ms)\n`);
            } else {
                console.log(`${colors.red}✗ 失败${colors.reset} (退出码: ${code})\n`);
            }

            resolve(result);
        });

        child.on('error', (error) => {
            console.error(`${colors.red}✗ 运行错误: ${error.message}${colors.reset}\n`);
            resolve({
                suite: suite.name,
                phase: suite.phase,
                file: suite.file,
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        });
    });
}

/**
 * 打印测试报告
 */
function printReport(results) {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bright}${colors.cyan}测试运行报告${colors.reset}`);
    console.log('='.repeat(60));

    console.log(`\n${colors.bright}总览:${colors.reset}`);
    console.log(`  测试套件: ${testSuites.length}`);
    console.log(`  ${colors.green}通过: ${passed}${colors.reset}`);
    console.log(`  ${failed > 0 ? colors.red : colors.dim}失败: ${failed}${colors.reset}`);
    console.log(`  总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);

    console.log(`\n${colors.bright}详细结果:${colors.reset}`);
    results.forEach((result, index) => {
        const icon = result.passed ? '✓' : '✗';
        const color = result.passed ? colors.green : colors.red;
        console.log(`  ${index + 1}. ${color}${icon} ${result.suite}${colors.reset}`);
        console.log(`     Phase: ${result.phase} | 耗时: ${result.duration}ms`);
        if (result.error) {
            console.log(`     ${colors.red}错误: ${result.error}${colors.reset}`);
        }
    });

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
        console.log(`${colors.green}${colors.bright}✓ 所有测试通过！${colors.reset}`);
        console.log('='.repeat(60) + '\n');
        return true;
    } else {
        console.log(`${colors.red}${colors.bright}✗ ${failed} 个测试失败${colors.reset}`);
        console.log('='.repeat(60) + '\n');
        return false;
    }
}

/**
 * 生成 Markdown 测试报告
 */
function generateMarkdownReport(results) {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    let report = `# Phase 2 测试运行报告\n\n`;
    report += `**运行时间**: ${dateStr} ${timeStr}\n`;
    report += `**运行环境**: Node.js ${process.version}\n`;
    report += `**测试框架**: 自定义 (assert-based)\n\n`;

    report += `---\n\n## 📊 测试总览\n\n`;
    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| 测试套件 | ${testSuites.length} |\n`;
    report += `| 通过 | ${passed} ✅ |\n`;
    report += `| 失败 | ${failed} ${failed > 0 ? '❌' : '✅'} |\n`;
    report += `| 总耗时 | ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s) |\n`;
    report += `| 成功率 | ${((passed / testSuites.length) * 100).toFixed(1)}% |\n\n`;

    report += `---\n\n## 📝 详细结果\n\n`;

    results.forEach((result, index) => {
        const status = result.passed ? '✅ 通过' : '❌ 失败';
        report += `### ${index + 1}. ${result.suite}\n\n`;
        report += `- **状态**: ${status}\n`;
        report += `- **Phase**: ${result.phase}\n`;
        report += `- **文件**: [${result.file}](../../tests/${result.file})\n`;
        report += `- **耗时**: ${result.duration}ms\n`;

        if (result.error) {
            report += `- **错误**: \`${result.error}\`\n`;
        }

        report += `\n`;
    });

    report += `---\n\n## 🎯 下一步\n\n`;

    if (failed === 0) {
        report += `✅ 所有测试通过！Phase 2 测试覆盖完整。\n\n`;
        report += `下一步行动：\n`;
        report += `- Phase 2.9 浏览器验证 (Worklet 模式)\n`;
        report += `- Phase 2.10 完成标记\n`;
        report += `- Phase 3 规划\n`;
    } else {
        report += `❌ 存在 ${failed} 个失败的测试套件。\n\n`;
        report += `需要修复的测试：\n\n`;
        results.filter(r => !r.passed).forEach(r => {
            report += `- ${r.suite} ([${r.file}](../../tests/${r.file}))\n`;
        });
    }

    report += `\n---\n\n`;
    report += `**报告生成**: 自动生成 by run-all-tests.js\n`;
    report += `**版本**: Phase 2.10\n`;

    return report;
}

/**
 * 主函数
 */
async function main() {
    console.log(`${colors.bright}${colors.cyan}`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         Phase 2 Test Suite Runner (v1.0.0)                ║');
    console.log('║         MAMBO Web v0.1.0                                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

    console.log(`\n${colors.dim}正在运行 ${testSuites.length} 个测试套件...${colors.reset}\n`);

    const results = [];

    // 串行运行所有测试
    for (const suite of testSuites) {
        const result = await runTest(suite);
        results.push(result);
    }

    // 打印控制台报告
    const allPassed = printReport(results);

    // 生成 Markdown 报告 (可选)
    if (process.argv.includes('--report')) {
        const { writeFileSync } = await import('fs');
        const reportPath = join(dirname(__dirname), 'docs', 'phase2', 'PHASE2_TEST_REPORT.md');
        const markdown = generateMarkdownReport(results);

        try {
            writeFileSync(reportPath, markdown, 'utf-8');
            console.log(`${colors.green}✓ 测试报告已生成: ${reportPath}${colors.reset}\n`);
        } catch (error) {
            console.error(`${colors.red}✗ 生成报告失败: ${error.message}${colors.reset}\n`);
        }
    } else {
        console.log(`${colors.dim}💡 提示: 使用 --report 参数生成 Markdown 报告${colors.reset}\n`);
    }

    // 退出码
    process.exit(allPassed ? 0 : 1);
}

// 运行
main().catch((error) => {
    console.error(`${colors.red}✗ 运行失败: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
});
