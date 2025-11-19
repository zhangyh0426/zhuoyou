// 数据库连接诊断脚本
// database-diagnostic.js

const mysql = require('mysql2/promise');

async function diagnoseDatabase() {
  console.log('🔍 数据库连接诊断开始...\n');
  
  // 1. 网络连通性测试
  console.log('📡 网络测试...');
  try {
    const net = require('net');
    const isConnected = await new Promise((resolve) => {
      const socket = new net.Socket();
      const isConnected = false;
      
      socket.setTimeout(5000);
      socket.on('connect', function() {
        console.log('✅ 端口 3307 可达');
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', function() {
        console.log('❌ 端口 3307 连接超时');
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', function(err) {
        console.log('❌ 网络连接失败:', err.code);
        resolve(false);
      });
      
      socket.connect(3307, 'mysql2.sqlpub.com');
    });
    
    if (!isConnected) {
      console.log('💡 请检查:');
      console.log('   1. 网络连接是否正常');
      console.log('   2. 防火墙设置');
      console.log('   3. 云服务器状态');
      return;
    }
  } catch (error) {
    console.log('❌ 网络诊断失败:', error.message);
  }
  
  // 2. 数据库配置检查
  console.log('\n⚙️  配置检查...');
  console.log('✅ 主机: mysql2.sqlpub.com');
  console.log('✅ 端口: 3307');
  console.log('✅ 数据库: zhuoyou');
  console.log('ℹ️  用户: simon0426');
  
  // 3. 尝试连接
  console.log('\n🔗 尝试数据库连接...');
  
  try {
    const connection = await mysql.createConnection({
      host: 'mysql2.sqlpub.com',
      port: 3307,
      user: 'simon0426',
      password: 'mDsZsr1j6lTyZdrN',
      database: 'zhuoyou',
      charset: 'utf8mb4',
      connectTimeout: 10000,
      // 移除无效配置选项
    });
    
    console.log('✅ 数据库连接成功！');
    
    // 4. 测试基本查询
    console.log('\n📊 数据表检查...');
    
    const tables = [
      'users',
      'activities', 
      'transactions',
      'member_cards',
      'store_status'
    ];
    
    for (const tableName of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`  📋 ${tableName}: ${rows[0].count} 条记录`);
      } catch (error) {
        console.log(`  ⚠️  ${tableName}: 表不存在或查询失败`);
      }
    }
    
    await connection.end();
    console.log('\n✅ 数据库诊断完成 - 连接正常');
    
  } catch (error) {
    console.log('❌ 数据库连接失败');
    console.log('错误详情:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 认证失败解决方案:');
      console.log('   1. 检查用户名和密码');
      console.log('   2. 确认用户权限');
      console.log('   3. 检查数据库访问策略');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 连接被拒绝解决方案:');
      console.log('   1. 检查数据库服务是否运行');
      console.log('   2. 确认端口配置');
      console.log('   3. 检查云服务器安全组设置');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 连接超时解决方案:');
      console.log('   1. 检查网络连接');
      console.log('   2. 增加连接超时时间');
      console.log('   3. 检查云服务器性能');
    }
  }
}

// 运行诊断
diagnoseDatabase();