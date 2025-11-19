/**
 * 微信云数据库连接验证脚本
 * 运行此脚本可以检查云数据库连接状态
 */

const { WeixinCloudDatabase } = require('./utils/weixin-cloud-database');

class CloudConnectionVerifier {
  constructor() {
    this.cloudDB = new WeixinCloudDatabase();
    this.results = [];
  }

  // 添加验证结果
  addResult(message, status, details = '') {
    this.results.push({
      message,
      status,
      details,
      timestamp: new Date().toLocaleString()
    });
    console.log(`[${status.toUpperCase()}] ${message} ${details ? '- ' + details : ''}`);
  }

  // 验证云开发环境
  async verifyCloudEnvironment() {
    this.addResult('开始验证微信云开发环境', 'info');
    
    try {
      // 检查微信云开发API是否存在
      if (typeof wx === 'undefined' || !wx.cloud) {
        this.addResult('微信云开发API未找到', 'error', '请确保在微信小程序环境中运行');
        return false;
      }
      
      this.addResult('微信云开发API检测成功', 'success');
      
      // 尝试初始化云开发环境
      const envId = 'cloud1-2gq89p31220bb320';
      const initResult = await this.cloudDB.init(envId);
      
      if (initResult) {
        this.addResult('云开发环境初始化成功', 'success', `环境ID: ${envId}`);
        return true;
      } else {
        this.addResult('云开发环境初始化失败', 'error');
        return false;
      }
    } catch (error) {
      this.addResult('云开发环境验证失败', 'error', error.message);
      return false;
    }
  }

  // 验证数据库连接
  async verifyDatabaseConnection() {
    this.addResult('开始验证数据库连接', 'info');
    
    try {
      // 测试基本连接
      const healthCheck = await this.cloudDB.healthCheck();
      
      if (healthCheck) {
        this.addResult('数据库连接正常', 'success');
        return true;
      } else {
        this.addResult('数据库连接异常', 'error');
        return false;
      }
    } catch (error) {
      this.addResult('数据库连接验证失败', 'error', error.message);
      return false;
    }
  }

  // 验证数据集合
  async verifyCollections() {
    this.addResult('开始验证数据集合', 'info');
    
    const collections = [
      'users',
      'member_cards', 
      'transactions',
      'activities',
      'activity_participants',
      'store_status',
      'admins'
    ];
    
    let successCount = 0;
    
    for (const collectionName of collections) {
      try {
        // 尝试访问集合
        const result = await this.cloudDB.db.collection(collectionName).limit(1).get();
        this.addResult(`集合 ${collectionName} 验证成功`, 'success', `记录数: ${result.data.length}`);
        successCount++;
      } catch (error) {
        this.addResult(`集合 ${collectionName} 验证失败`, 'error', error.message);
      }
    }
    
    this.addResult(`集合验证完成: ${successCount}/${collections.length} 个集合正常`, 'info');
    return successCount === collections.length;
  }

  // 验证基本数据操作
  async verifyDataOperations() {
    this.addResult('开始验证数据操作功能', 'info');
    
    try {
      // 测试添加用户
      const testUser = {
        phone: 'test_' + Date.now(),
        name: '测试用户',
        avatarUrl: 'https://example.com/test.jpg'
      };
      
      const userResult = await this.cloudDB.addUser(testUser);
      this.addResult('用户添加功能正常', 'success', `用户ID: ${userResult._id}`);
      
      // 测试查询用户
      const foundUser = await this.cloudDB.getUser(testUser.phone);
      if (foundUser) {
        this.addResult('用户查询功能正常', 'success', `用户名: ${foundUser.name}`);
      } else {
        this.addResult('用户查询功能异常', 'error');
        return false;
      }
      
      // 测试更新用户
      const updatedUser = await this.cloudDB.updateUser(testUser.phone, {
        name: '更新后的用户名'
      });
      if (updatedUser && updatedUser.name === '更新后的用户名') {
        this.addResult('用户更新功能正常', 'success');
      } else {
        this.addResult('用户更新功能异常', 'error');
        return false;
      }
      
      // 测试删除用户（如果支持）
      try {
        await this.cloudDB.deleteUser(testUser.phone);
        this.addResult('用户删除功能正常', 'success');
      } catch (error) {
        this.addResult('用户删除功能未实现或异常', 'warning', error.message);
      }
      
      return true;
    } catch (error) {
      this.addResult('数据操作验证失败', 'error', error.message);
      return false;
    }
  }

  // 验证云函数调用
  async verifyCloudFunctions() {
    this.addResult('开始验证云函数调用', 'info');
    
    try {
      // 测试 userAuth 云函数
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'getUserInfo',
          data: {
            phone: 'test_phone'
          }
        }
      });
      
      if (result && result.result) {
        this.addResult('云函数调用正常', 'success', `userAuth 云函数响应正常`);
        return true;
      } else {
        this.addResult('云函数调用异常', 'error', '未收到预期响应');
        return false;
      }
    } catch (error) {
      this.addResult('云函数调用失败', 'error', error.message);
      return false;
    }
  }

  // 运行完整验证
  async runFullVerification() {
    console.log('\n🚀 开始微信云数据库连接验证...\n');
    
    this.results = [];
    const verificationSteps = [
      { name: '云开发环境', method: this.verifyCloudEnvironment.bind(this) },
      { name: '数据库连接', method: this.verifyDatabaseConnection.bind(this) },
      { name: '数据集合', method: this.verifyCollections.bind(this) },
      { name: '数据操作', method: this.verifyDataOperations.bind(this) },
      { name: '云函数', method: this.verifyCloudFunctions.bind(this) }
    ];
    
    let allPassed = true;
    
    for (const step of verificationSteps) {
      console.log(`\n--- ${step.name} 验证 ---`);
      const passed = await step.method();
      
      if (!passed) {
        allPassed = false;
        console.log(`❌ ${step.name} 验证失败`);
      } else {
        console.log(`✅ ${step.name} 验证通过`);
      }
    }
    
    console.log('\n📊 验证总结:');
    console.log('=' .repeat(50));
    
    this.results.forEach(result => {
      const status = result.status === 'success' ? '✅' : 
                    result.status === 'error' ? '❌' : '⚠️';
      console.log(`${status} ${result.message}`);
    });
    
    console.log('=' .repeat(50));
    
    if (allPassed) {
      console.log('\n🎉 所有验证通过！云数据库连接正常。');
    } else {
      console.log('\n⚠️ 部分验证失败，请检查错误信息。');
    }
    
    return {
      success: allPassed,
      results: this.results
    };
  }
}

// 导出验证器
module.exports = CloudConnectionVerifier;

// 如果在微信小程序环境中运行，可以执行验证
if (typeof wx !== 'undefined') {
  const verifier = new CloudConnectionVerifier();
  verifier.runFullVerification().then(result => {
    console.log('验证完成:', result);
  }).catch(error => {
    console.error('验证过程出错:', error);
  });
}