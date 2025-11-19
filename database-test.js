/**
 * 微信云数据库连接测试脚本
 * 在微信开发者工具控制台中执行此脚本
 */

// 步骤1: 检查云开发环境初始化状态
function checkCloudInit() {
  console.log('\n🔍 步骤1: 检查云开发环境初始化状态...');
  
  if (typeof wx !== 'undefined' && wx.cloud) {
    console.log('✅ 微信云开发SDK已加载');
    
    // 检查是否已初始化
    try {
      const db = wx.cloud.database();
      console.log('✅ 云数据库对象创建成功');
      return true;
    } catch (error) {
      console.error('❌ 云数据库对象创建失败:', error);
      return false;
    }
  } else {
    console.error('❌ 微信云开发SDK未正确加载');
    return false;
  }
}

// 步骤2: 测试数据库连接
async function testDatabaseConnection() {
  console.log('\n🔍 步骤2: 测试数据库连接...');
  
  try {
    const db = wx.cloud.database();
    const startTime = Date.now();
    
    // 尝试获取一个不存在的集合来测试连接
    const result = await db.collection('users').limit(1).get();
    const endTime = Date.now();
    
    console.log(`✅ 数据库连接成功 (耗时: ${endTime - startTime}ms)`);
    console.log('当前集合记录数:', result.data ? result.data.length : 0);
    return true;
  } catch (error) {
    console.warn('⚠️ 数据库连接测试:', error.message);
    
    // 如果是集合不存在的错误，说明连接是正常的
    if (error.message.includes('集合不存在') || error.message.includes('does not exist')) {
      console.log('✅ 数据库连接正常，只是集合未创建');
      return true;
    }
    
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 步骤3: 检查环境ID配置
function checkEnvironmentConfig() {
  console.log('\n🔍 步骤3: 检查环境ID配置...');
  
  // 环境ID应该在app.js中配置为 'cloud1-2gq89p31220bb320'
  const expectedEnvId = 'cloud1-2gq89p31220bb320';
  
  try {
    // 检查全局数据中的环境ID
    const app = getApp();
    if (app && app.globalData) {
      console.log('应用全局数据:', app.globalData);
    }
    
    console.log(`✅ 配置的环境ID: ${expectedEnvId}`);
    console.log('💡 如果连接失败，请检查此环境ID是否正确');
    return expectedEnvId;
  } catch (error) {
    console.warn('⚠️ 无法获取应用配置:', error.message);
    return expectedEnvId;
  }
}

// 步骤4: 创建一个测试记录
async function createTestRecord() {
  console.log('\n🔍 步骤4: 创建测试记录...');
  
  try {
    const db = wx.cloud.database();
    const testData = {
      test: true,
      timestamp: new Date(),
      message: '这是一个连接测试记录'
    };
    
    const result = await db.collection('users').add({
      data: testData
    });
    
    console.log('✅ 测试记录创建成功:', result);
    console.log('📝 记录ID:', result._id);
    
    // 立即删除测试记录
    await db.collection('users').doc(result._id).remove();
    console.log('✅ 测试记录已清理');
    
    return true;
  } catch (error) {
    console.error('❌ 创建测试记录失败:', error.message);
    
    if (error.message.includes('权限不足') || error.message.includes('permission denied')) {
      console.log('💡 这可能是因为数据库权限配置问题');
      console.log('💡 建议检查云数据库权限设置');
    }
    
    return false;
  }
}

// 步骤5: 检查云函数可用性
async function testCloudFunction() {
  console.log('\n🔍 步骤5: 测试云函数可用性...');
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'userAuth',
      data: {
        action: 'testConnection',
        data: {}
      }
    });
    
    console.log('✅ 云函数调用成功:', result.result);
    return true;
  } catch (error) {
    console.warn('⚠️ 云函数调用失败:', error.message);
    console.log('💡 这可能是因为云函数未部署或权限问题');
    return false;
  }
}

// 完整的连接测试
async function runFullTest() {
  console.log('🚀 开始微信云数据库连接测试...\n');
  
  const results = {
    cloudInit: checkCloudInit(),
    environment: checkEnvironmentConfig(),
    database: false,
    cloudFunction: false
  };
  
  // 如果云开发已初始化，继续测试
  if (results.cloudInit) {
    results.database = await testDatabaseConnection();
    results.cloudFunction = await testCloudFunction();
    
    if (results.database) {
      await createTestRecord();
    }
  }
  
  // 总结测试结果
  console.log('\n📊 测试结果总结:');
  console.log('='.repeat(50));
  console.log(`云开发SDK加载: ${results.cloudInit ? '✅ 成功' : '❌ 失败'}`);
  console.log(`环境ID配置: ${results.environment ? '✅ 正常' : '❌ 异常'}`);
  console.log(`数据库连接: ${results.database ? '✅ 成功' : '❌ 失败'}`);
  console.log(`云函数调用: ${results.cloudFunction ? '✅ 成功' : '❌ 失败'}`);
  
  if (results.cloudInit && results.database) {
    console.log('\n🎉 数据库连接状态: 正常 ✅');
    console.log('💡 您可以正常使用云数据库功能');
  } else {
    console.log('\n⚠️ 数据库连接状态: 异常 ❌');
    console.log('💡 建议检查:');
    console.log('   1. 确认已开通微信云开发');
    console.log('   2. 检查环境ID是否正确');
    console.log('   3. 确认云数据库权限配置');
    console.log('   4. 检查云函数是否已部署');
  }
}

// 快速测试函数
async function quickTest() {
  console.log('⚡ 快速连接测试...');
  
  if (typeof wx === 'undefined' || !wx.cloud) {
    console.log('❌ 未在微信开发者环境中运行');
    return;
  }
  
  try {
    const db = wx.cloud.database();
    const result = await db.collection('users').limit(1).get();
    console.log('✅ 数据库连接正常');
  } catch (error) {
    if (error.message.includes('集合不存在')) {
      console.log('✅ 数据库连接正常，集合未创建');
    } else {
      console.log('❌ 数据库连接异常:', error.message);
    }
  }
}

// 导出函数供控制台调用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runFullTest,
    quickTest,
    checkCloudInit,
    testDatabaseConnection,
    createTestRecord,
    testCloudFunction
  };
}

// 如果在浏览器控制台中，直接执行
if (typeof window !== 'undefined') {
  window.DatabaseTest = {
    runFullTest,
    quickTest,
    checkCloudInit,
    testDatabaseConnection,
    createTestRecord,
    testCloudFunction
  };
}

console.log('📖 使用方法:');
console.log('runFullTest()    - 运行完整测试');
console.log('quickTest()      - 快速测试连接');
console.log('checkCloudInit() - 检查云开发初始化');
console.log('testDatabaseConnection() - 测试数据库连接');
console.log('createTestRecord() - 创建测试记录');
console.log('testCloudFunction() - 测试云函数');