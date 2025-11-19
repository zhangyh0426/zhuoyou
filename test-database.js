// 数据库连接测试脚本
// test-database.js

const { getDatabaseManager } = require('./utils/database');

async function testDatabase() {
  const dbManager = getDatabaseManager();
  
  console.log('🔍 正在测试数据库连接...');
  
  try {
    // 测试连接
    const connected = await dbManager.init();
    
    if (connected) {
      console.log('✅ 数据库连接成功');
      
      // 检查表结构
      console.log('\n📊 数据表状态:');
      
      const tables = [
        { name: 'users', sql: 'SELECT COUNT(*) as count FROM users' },
        { name: 'activities', sql: 'SELECT COUNT(*) as count FROM activities' },
        { name: 'transactions', sql: 'SELECT COUNT(*) as count FROM transactions' },
        { name: 'member_cards', sql: 'SELECT COUNT(*) as count FROM member_cards' },
        { name: 'store_status', sql: 'SELECT COUNT(*) as count FROM store_status' }
      ];
      
      for (const table of tables) {
        try {
          const result = await dbManager.execute(table.sql);
          console.log(`  📋 ${table.name}: ${result[0].count} 条记录`);
        } catch (error) {
          console.log(`  ❌ ${table.name}: ${error.message}`);
        }
      }
      
      // 检查连接详情
      console.log('\n🔗 连接信息:');
      console.log(`  主机: mysql2.sqlpub.com`);
      console.log(`  端口: 3307`);
      console.log(`  数据库: zhuoyou`);
      console.log(`  状态: 正常连接`);
      
      console.log('\n✅ 数据库测试完成');
    } else {
      console.log('❌ 数据库连接失败');
    }
  } catch (error) {
    console.error('❌ 数据库测试失败:', error.message);
  }
}

// 运行测试
testDatabase();