-- =====================================================================
--  演出票务平台 · 建表 SQL（MySQL 5.7+ / 8.0，utf8mb4）
--  执行方式：
--     mysql -u root -p show_ticket < database/schema.sql
--  或：cd server && npm run init-db  （自动建库建表 + 初始化演示数据）
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------- 1. 用户表 ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone`         VARCHAR(20)  NOT NULL COMMENT '手机号（登录账号）',
  `password`      VARCHAR(128) NOT NULL COMMENT 'bcrypt 密码',
  `nickname`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像URL',
  `gender`        TINYINT      NOT NULL DEFAULT 0 COMMENT '0未知 1男 2女',
  `birthday`      DATE         NULL COMMENT '生日',
  `city`          VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '常驻城市',
  `invite_code_id` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '注册使用的邀请码ID',
  `role`          TINYINT      NOT NULL DEFAULT 0 COMMENT '0普通用户 1管理员',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ---------------------------- 2. 邀请码表 ----------------------------
DROP TABLE IF EXISTS `invite_codes`;
CREATE TABLE `invite_codes` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(32)  NOT NULL COMMENT '邀请码',
  `status`     TINYINT      NOT NULL DEFAULT 0 COMMENT '0未使用 1已使用',
  `used_by`    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '使用者用户ID',
  `used_at`    DATETIME     NULL,
  `created_by` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '生成人（管理员ID）',
  `expires_at` DATETIME     NULL COMMENT '过期时间，NULL 表示永不过期',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请码表（注册必填）';

-- ---------------------------- 3. 城市表 ----------------------------
DROP TABLE IF EXISTS `cities`;
CREATE TABLE `cities` (
  `id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`   VARCHAR(50) NOT NULL,
  `is_hot` TINYINT     NOT NULL DEFAULT 0 COMMENT '1热门城市',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='城市字典';

INSERT INTO `cities` (`name`, `is_hot`) VALUES
('北京',1),('上海',1),('广州',1),('深圳',1),('杭州',1),('成都',1),
('武汉',0),('西安',0),('南京',0),('重庆',0),('长沙',0),('苏州',0),
('天津',0),('郑州',0),('青岛',0),('厦门',0),('昆明',0),('沈阳',0);

-- ---------------------------- 4. 场馆表 ----------------------------
DROP TABLE IF EXISTS `venues`;
CREATE TABLE `venues` (
  `id`       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `city`     VARCHAR(50)  NOT NULL DEFAULT '',
  `name`     VARCHAR(120) NOT NULL COMMENT '场馆名称',
  `address`  VARCHAR(255) NOT NULL DEFAULT '',
  `capacity` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场馆表';

INSERT INTO `venues` (`city`, `name`, `address`) VALUES
('北京','国家体育场（鸟巢）','北京市朝阳区国家体育场南路1号'),
('北京','北京喜剧院','北京市东城区朝阳门北大街'),
('上海','梅赛德斯奔驰文化中心','上海市浦东新区世博大道1200号'),
('上海','上剧场','上海市徐汇区肇嘉浜路'),
('广州','广州大剧院','广州市天河区珠江东路1号'),
('杭州','杭州奥体中心体育馆','杭州市萧山区奔竞大道'),
('成都','成都东郊记忆','成都市成华区建设南支路4号'),
('武汉','武汉园博园','武汉市东西湖区园博园路');

-- ---------------------------- 5. 演出表 ----------------------------
DROP TABLE IF EXISTS `shows`;
CREATE TABLE `shows` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(200) NOT NULL COMMENT '演出名称',
  `subtitle`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '副标题',
  `category`    VARCHAR(20)  NOT NULL DEFAULT 'concert' COMMENT 'concert演唱会 drama话剧 talk脱口秀 festival音乐节 sports体育 other',
  `poster`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '海报URL',
  `source_poster` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '公网原始海报URL（用于判断图片是否需要重新同步）',
  `artist`      VARCHAR(200) NOT NULL DEFAULT '' COMMENT '艺人/团体',
  `venue_name`  VARCHAR(120) NOT NULL DEFAULT '' COMMENT '场馆名称',
  `city`        VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '城市',
  `address`     VARCHAR(255) NOT NULL DEFAULT '',
  `start_time`  DATETIME     NULL COMMENT '开演时间',
  `end_time`    DATETIME     NULL COMMENT '结束时间',
  `min_price`   DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最低票价',
  `max_price`   DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最高票价',
  `tags`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '标签，逗号分隔',
  `description` TEXT         COMMENT '演出详情',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '1上架 0下架',
  `hot_score`   INT          NOT NULL DEFAULT 50 COMMENT '热度分（排序用）',
  `view_count`  INT          NOT NULL DEFAULT 0 COMMENT '浏览量',
  `sold_count`  INT          NOT NULL DEFAULT 0 COMMENT '销量',
  `source`      VARCHAR(20)  NOT NULL DEFAULT 'admin' COMMENT '数据来源 admin/sync',
  `source_id`   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '外部数据源ID',
  `sync_time`   DATETIME     NULL COMMENT '最近同步时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_city` (`city`),
  KEY `idx_category` (`category`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status_hot` (`status`, `hot_score`),
  KEY `idx_source_id` (`source_id`),
  FULLTEXT KEY `ft_search` (`title`, `artist`, `venue_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='演出表';

-- ---------------------------- 6. 票档表（官方票品）----------------------------
DROP TABLE IF EXISTS `ticket_tiers`;
CREATE TABLE `ticket_tiers` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `show_id`        INT UNSIGNED NOT NULL,
  `name`           VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '票档名称，如 看台380',
  `price`          DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '售价',
  `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '原价',
  `stock`          INT          NOT NULL DEFAULT 0 COMMENT '库存',
  `description`    VARCHAR(255) NOT NULL DEFAULT '',
  `status`         TINYINT      NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_show` (`show_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='演出票档表';

-- ---------------------------- 7. 订单表 ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no`      VARCHAR(40)  NOT NULL COMMENT '订单号',
  `user_id`       INT UNSIGNED NOT NULL COMMENT '买家',
  `seller_id`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '卖家（官方票为0）',
  `source`        VARCHAR(20)  NOT NULL DEFAULT 'official' COMMENT 'official官方 resale二手',
  `show_id`       INT UNSIGNED NOT NULL,
  `ticket_id`     INT UNSIGNED NULL COMMENT '二手票ID',
  `tier_id`       INT UNSIGNED NULL COMMENT '票档ID',
  `tier_name`     VARCHAR(120) NOT NULL DEFAULT '' COMMENT '票档快照名称',
  `unit_price`    DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '单价快照',
  `quantity`      INT          NOT NULL DEFAULT 1,
  `amount`        DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '订单总额',
  `buyer_name`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '买方姓名',
  `contact_name`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '取票人',
  `contact_phone` VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '联系电话',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待支付 1已支付 2已取消 3已完成 4已退款',
  `pay_method`    VARCHAR(20)  NOT NULL DEFAULT '' COMMENT 'wechat/alipay/balance',
  `pay_no`        VARCHAR(60)  NOT NULL DEFAULT '' COMMENT '支付流水号',
  `remark`        VARCHAR(255) NOT NULL DEFAULT '',
  `paid_at`       DATETIME     NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user` (`user_id`, `status`),
  KEY `idx_seller` (`seller_id`),
  KEY `idx_show` (`show_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ---------------------------- 8. 二手票（卖家挂票）----------------------------
DROP TABLE IF EXISTS `resale_tickets`;
CREATE TABLE `resale_tickets` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id`      INT UNSIGNED NOT NULL,
  `show_id`        INT UNSIGNED NOT NULL,
  `title`          VARCHAR(200) NOT NULL DEFAULT '' COMMENT '标题',
  `tier_name`      VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '票档/票面',
  `seat_info`      VARCHAR(200) NOT NULL DEFAULT '' COMMENT '座位信息，如 3排12号',
  `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '票面价',
  `sell_price`     DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '转让价',
  `quantity`       INT          NOT NULL DEFAULT 1 COMMENT '可售数量',
  `sold_count`     INT          NOT NULL DEFAULT 0,
  `description`    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '转让说明',
  `images`         TEXT         COMMENT '票品图片JSON数组',
  `contact_phone`  VARCHAR(30)  NOT NULL DEFAULT '',
  `status`         TINYINT      NOT NULL DEFAULT 0 COMMENT '0在售 1已售出 2已下架',
  `view_count`     INT          NOT NULL DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_seller` (`seller_id`),
  KEY `idx_show` (`show_id`),
  KEY `idx_status_price` (`status`, `sell_price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='二手票务集市（卖家挂票）';

-- ---------------------------- 9. 收藏表 ----------------------------
DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `show_id`    INT UNSIGNED NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_show` (`user_id`, `show_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表';

-- ---------------------------- 10. 浏览记录表 ----------------------------
DROP TABLE IF EXISTS `browse_history`;
CREATE TABLE `browse_history` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `show_id`    INT UNSIGNED NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浏览记录表';

-- ---------------------------- 11. 用户留言表 ----------------------------
DROP TABLE IF EXISTS `user_messages`;
CREATE TABLE `user_messages` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL DEFAULT 0,
  `nickname`   VARCHAR(50)  NOT NULL DEFAULT '',
  `content`    VARCHAR(500) NOT NULL COMMENT '留言内容',
  `contact`    VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '联系方式',
  `reply`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '管理员回复',
  `status`     TINYINT      NOT NULL DEFAULT 0 COMMENT '0待审核 1通过 2拒绝',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `audited_at` DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户留言表（需后台审核）';

-- ---------------------------- 12/13. 私聊（转票沟通）----------------------------
DROP TABLE IF EXISTS `chat_conversations`;
CREATE TABLE `chat_conversations` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_a`          INT UNSIGNED NOT NULL COMMENT '发起方（买家）',
  `user_b`          INT UNSIGNED NOT NULL COMMENT '接收方（卖家）',
  `ticket_id`       INT UNSIGNED NULL COMMENT '关联的二手票',
  `show_id`         INT UNSIGNED NULL,
  `last_message`    VARCHAR(200) NOT NULL DEFAULT '',
  `last_message_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pair` (`user_a`, `user_b`, `ticket_id`),
  KEY `idx_users` (`user_a`, `user_b`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='私聊会话表';

DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` INT UNSIGNED NOT NULL,
  `sender_id`       INT UNSIGNED NOT NULL,
  `type`            VARCHAR(20)  NOT NULL DEFAULT 'text' COMMENT 'text/image/order',
  `content`         VARCHAR(1000) NOT NULL DEFAULT '',
  `is_read`         TINYINT      NOT NULL DEFAULT 0,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv` (`conversation_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='私聊消息表';

-- ---------------------------- 14. 首页轮播表 ----------------------------
DROP TABLE IF EXISTS `banners`;
CREATE TABLE `banners` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`     VARCHAR(120) NOT NULL DEFAULT '',
  `image`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '轮播图URL',
  `show_id`   INT UNSIGNED NULL COMMENT '跳转演出ID',
  `link`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '外链',
  `sort`      INT NOT NULL DEFAULT 0,
  `status`    TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播表';

-- ---------------------------- 15. 搜索热词表 ----------------------------
DROP TABLE IF EXISTS `search_hot`;
CREATE TABLE `search_hot` (
  `id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `keyword` VARCHAR(80) NOT NULL,
  `times`   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_keyword` (`keyword`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搜索热词表';

INSERT INTO `search_hot` (`keyword`, `times`) VALUES
('周杰伦', 999),('演唱会', 888),('脱口秀', 666),('开心麻花', 555),('音乐节', 444),('话剧', 333);

-- ---------------------------- 16. 同步日志表 ----------------------------
DROP TABLE IF EXISTS `sync_logs`;
CREATE TABLE `sync_logs` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `source`        VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '数据来源 api/mock',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '1成功 0失败',
  `total`         INT NOT NULL DEFAULT 0,
  `created_count` INT NOT NULL DEFAULT 0,
  `updated_count` INT NOT NULL DEFAULT 0,
  `message`       VARCHAR(255) NOT NULL DEFAULT '',
  `started_at`    DATETIME NULL,
  `finished_at`   DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_finished` (`finished_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='演出资讯同步日志';

SET FOREIGN_KEY_CHECKS = 1;
