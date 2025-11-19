// 云函数：用户认证和注册
// cloudfunctions/userAuth/index.js

const cloud = require('wx-server-sdk');
const { getDatabaseManager } = require('../../utils/database');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action, data } = event;
  const dbManager = getDatabaseManager();

  try {
    // 确保数据库连接
    if (!dbManager.isHealthy()) {
      await dbManager.init();
    }

    switch (action) {
    case 'login':
      return await handleLogin(data, dbManager);
    case 'register':
      return await handleRegister(data, dbManager);
    case 'getUserInfo':
      return await getUserInfo(data, dbManager);
    case 'updateUserInfo':
      return await updateUserInfo(data, dbManager);
    case 'createCollections':
      return await createCollections(data);
    default:
      throw new Error('未知操作');
    }
  } catch (error) {
    console.error('用户认证云函数错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 处理用户登录
async function handleLogin(data, dbManager) {
  const { phone, name, avatarUrl } = data;

  if (!phone || !name) {
    throw new Error('手机号和姓名不能为空');
  }

  // 保存或更新用户信息
  const user = await dbManager.saveUser({
    phone,
    name,
    avatarUrl
  });

  // 获取会员卡信息
  const memberCard = await dbManager.getMemberCard(phone);

  // 记录最后登录时间
  await dbManager.execute(
    'UPDATE users SET last_login_time = ? WHERE phone = ?',
    [new Date(), phone]
  );

  return {
    success: true,
    data: {
      userInfo: {
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatar_url,
        registerTime: user.register_time,
        lastLoginTime: new Date()
      },
      memberCard: memberCard ? {
        balance: parseFloat(memberCard.balance),
        points: memberCard.points,
        level: memberCard.level,
        joinDate: memberCard.join_date
      } : null
    }
  };
}

// 处理用户注册
async function handleRegister(data, dbManager) {
  const { phone, name, avatarUrl } = data;

  if (!phone || !name) {
    throw new Error('手机号和姓名不能为空');
  }

  // 检查用户是否已存在
  const existingUser = await dbManager.getUser(phone);
  if (existingUser) {
    throw new Error('用户已存在，请直接登录');
  }

  // 创建新用户
  const userId = await dbManager.insert('users', {
    phone,
    name,
    avatar_url: avatarUrl || null,
    register_time: new Date()
  });

  // 创建会员卡
  await dbManager.insert('member_cards', {
    user_phone: phone,
    balance: 0.00,
    points: 0,
    level: 'bronze',
    join_date: new Date()
  });

  return {
    success: true,
    data: {
      message: '注册成功',
      user: await dbManager.getUser(phone)
    }
  };
}

// 获取用户信息
async function getUserInfo(data, dbManager) {
  const { phone } = data;

  if (!phone) {
    throw new Error('手机号不能为空');
  }

  const user = await dbManager.getUser(phone);
  const memberCard = await dbManager.getMemberCard(phone);
  const transactionHistory = await dbManager.getTransactions(phone);

  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    success: true,
    data: {
      userInfo: {
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatar_url,
        registerTime: user.register_time,
        lastLoginTime: user.last_login_time
      },
      memberCard: memberCard ? {
        balance: parseFloat(memberCard.balance),
        points: memberCard.points,
        level: memberCard.level,
        joinDate: memberCard.join_date,
        lastTransactionTime: memberCard.last_transaction_time
      } : null,
      transactionHistory: transactionHistory.map(t => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceAfter: parseFloat(t.balance_after),
        description: t.description,
        status: t.status,
        createdAt: t.created_at
      }))
    }
  };
}

// 更新用户信息
async function updateUserInfo(data, dbManager) {
  const { phone, updates } = data;

  if (!phone) {
    throw new Error('手机号不能为空');
  }

  const updateData = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.avatarUrl) updateData.avatar_url = updates.avatarUrl;

  if (Object.keys(updateData).length > 0) {
    await dbManager.update('users', updateData, 'phone = ?', [phone]);
  }

  return {
    success: true,
    data: {
      message: '用户信息更新成功',
      user: await dbManager.getUser(phone)
    }
  };
}

// 创建云数据库集合
async function createCollections(data) {
  try {
    const { collections } = data;
    const db = cloud.database();
    
    console.log('开始创建云数据库集合...');
    
    // 创建集合
    for (const collection of collections) {
      try {
        // 尝试获取集合，如果不存在会抛出错误
        await db.collection(collection.name).limit(1).get();
        console.log(`集合 ${collection.name} 已存在`);
      } catch (error) {
        // 集合不存在，创建集合
        // 在小程序云开发中，集合会在第一次写入时自动创建
        // 这里我们添加一条测试数据来创建集合
        try {
          await db.collection(collection.name).add({
            data: {
              _test: true,
              create_time: new Date()
            }
          });
          console.log(`集合 ${collection.name} 创建成功`);
          
          // 删除测试数据
          await db.collection(collection.name)
            .where({ _test: true })
            .remove();
          console.log(`集合 ${collection.name} 测试数据已清理`);
        } catch (createError) {
          console.warn(`集合 ${collection.name} 创建失败:`, createError.message);
        }
      }
    }

    return {
      success: true,
      message: '云数据库集合创建完成',
      collections: collections.map(c => c.name)
    };
  } catch (error) {
    console.error('创建集合过程出错:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
