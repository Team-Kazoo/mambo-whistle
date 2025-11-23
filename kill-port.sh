#!/bin/bash
# 清理指定端口的所有进程
# 使用: ./kill-port.sh 3000

PORT=${1:-3000}

echo "🔍 检查端口 $PORT 占用情况..."

# 查找占用端口的进程
PIDS=$(lsof -ti:$PORT)

if [ -z "$PIDS" ]; then
    echo "✅ 端口 $PORT 未被占用"
    exit 0
fi

echo "⚠️  发现以下进程占用端口 $PORT:"
lsof -i:$PORT -P

echo ""
echo "🧹 清理这些进程..."
kill $PIDS 2>/dev/null

sleep 1

# 验证是否清理成功
REMAINING=$(lsof -ti:$PORT)
if [ -z "$REMAINING" ]; then
    echo "✅ 端口 $PORT 已释放"
else
    echo "⚠️  部分进程未终止，尝试强制 kill..."
    kill -9 $REMAINING 2>/dev/null
    sleep 1

    FINAL_CHECK=$(lsof -ti:$PORT)
    if [ -z "$FINAL_CHECK" ]; then
        echo "✅ 端口 $PORT 已强制释放"
    else
        echo "❌ 无法释放端口 $PORT，可能需要 sudo 权限"
        exit 1
    fi
fi
