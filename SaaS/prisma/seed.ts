import {
  LeftoverAmount,
  MealType,
  RecipeCategory,
  StorageType,
  VolumeFeeling,
  UserRole,
  PrismaClient,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data to keep PoC seeds deterministic.
  await prisma.mealFeedback.deleteMany();
  await prisma.menuPlanRecipe.deleteMany();
  await prisma.menuPlan.deleteMany();
  await prisma.procurementAdjustment.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.userVesselMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.company.deleteMany();

  // ========================================
  // Company & Vessel & User
  // ========================================
  const passwordHash = await hash("demo1234", 12);

  const company = await prisma.company.create({
    data: {
      id: "company-demo",
      name: "デモ船会社",
      slug: "demo-shipping",
    },
  });

  const vessel1 = await prisma.vessel.create({
    data: {
      id: "vessel-sakura",
      name: "桜丸",
      imoNumber: "IMO1234567",
      companyId: company.id,
    },
  });

  const vessel2 = await prisma.vessel.create({
    data: {
      id: "vessel-hikari",
      name: "光丸",
      imoNumber: "IMO7654321",
      companyId: company.id,
    },
  });

  // Chef user
  const chef = await prisma.user.create({
    data: {
      id: "user-chef",
      email: "chef@demo.wellship.jp",
      name: "山田 太郎（司厨）",
      passwordHash,
      role: UserRole.CHEF,
      companyId: company.id,
    },
  });

  await prisma.userVesselMembership.create({
    data: {
      userId: chef.id,
      vesselId: vessel1.id,
    },
  });

  // Manager user
  await prisma.user.create({
    data: {
      id: "user-manager",
      email: "manager@demo.wellship.jp",
      name: "佐藤 花子（管理者）",
      passwordHash,
      role: UserRole.MANAGER,
      companyId: company.id,
    },
  });



  // ========================================
  // CrewMembers (船員 - カード識別用)
  // ========================================
  await prisma.crewMember.deleteMany(); // Clean existing

  const crew1 = await prisma.crewMember.create({
    data: {
      id: "crew-tanaka",
      name: "田中 健一",
      cardCode: "CREW-SAKURA-001",
      vesselId: vessel1.id,
    },
  });

  const crew2 = await prisma.crewMember.create({
    data: {
      id: "crew-suzuki",
      name: "鈴木 大輔",
      cardCode: "CREW-SAKURA-002",
      vesselId: vessel1.id,
    },
  });

  const crew3 = await prisma.crewMember.create({
    data: {
      id: "crew-yamada",
      name: "山田 花子",
      cardCode: "CREW-SAKURA-003",
      vesselId: vessel1.id,
    },
  });

  const crew4 = await prisma.crewMember.create({
    data: {
      id: "crew-sato",
      name: "佐藤 次郎",
      cardCode: "CREW-HIKARI-001",
      vesselId: vessel2.id,
    },
  });

  console.log(`✅ Created ${4} crew members`);

  // ========================================
  // Ingredients (linked to company)
  // ========================================

  const ingredients = [
    // === 肉類 ===（業務用卸価格を想定）
    { id: "ing-chicken-thigh", name: "鶏もも肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-chicken-breast", name: "鶏むね肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-pork-belly", name: "豚バラ肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.2, companyId: company.id },
    { id: "ing-pork-loin", name: "豚ロース", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-beef-slice", name: "牛薄切り肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 3.5, companyId: company.id },
    { id: "ing-ground-pork", name: "豚ひき肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.8, companyId: company.id },
    { id: "ing-ground-beef", name: "牛ひき肉", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.8, companyId: company.id },
    { id: "ing-bacon", name: "ベーコン", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.2, companyId: company.id },
    { id: "ing-ham", name: "ハム", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-chashu", name: "焼豚", storageType: StorageType.chilled, unit: "g", costPerUnit: 3.0, companyId: company.id },
    // === 魚介類 ===（業務用卸価格を想定）
    { id: "ing-salmon", name: "サーモン切り身", storageType: StorageType.chilled, unit: "g", costPerUnit: 4.0, companyId: company.id },
    { id: "ing-mackerel", name: "さば切り身", storageType: StorageType.frozen, unit: "g", costPerUnit: 2.8, companyId: company.id },
    { id: "ing-shrimp", name: "むきエビ", storageType: StorageType.frozen, unit: "g", costPerUnit: 4.5, companyId: company.id },
    { id: "ing-tuna-sashimi", name: "まぐろ刺身用", storageType: StorageType.frozen, unit: "g", costPerUnit: 6.0, companyId: company.id },
    { id: "ing-hamachi-sashimi", name: "はまち刺身用", storageType: StorageType.frozen, unit: "g", costPerUnit: 5.0, companyId: company.id },
    { id: "ing-katsuo-sashimi", name: "カツオ刺身用", storageType: StorageType.frozen, unit: "g", costPerUnit: 4.5, companyId: company.id },
    { id: "ing-karei", name: "かれい切り身", storageType: StorageType.frozen, unit: "g", costPerUnit: 3.0, companyId: company.id },
    { id: "ing-shishamo", name: "ししゃも", storageType: StorageType.frozen, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-himono", name: "干物", storageType: StorageType.frozen, unit: "g", costPerUnit: 2.8, companyId: company.id },
    { id: "ing-fish-cake", name: "練り物", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-satsuma-age", name: "さつま揚げ", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.8, companyId: company.id },
    { id: "ing-mozuku", name: "もずく", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-wakame", name: "わかめ", storageType: StorageType.room, unit: "g", costPerUnit: 2.0, companyId: company.id },
    // === 豆腐・卵 ===
    { id: "ing-tofu", name: "木綿豆腐", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-atsuage", name: "厚揚げ", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-egg", name: "卵", storageType: StorageType.chilled, unit: "個", costPerUnit: 35, companyId: company.id },
    { id: "ing-natto", name: "納豆", storageType: StorageType.chilled, unit: "パック", costPerUnit: 50, companyId: company.id },
    // === 野菜類 ===
    { id: "ing-onion", name: "たまねぎ", storageType: StorageType.room, unit: "g", costPerUnit: 1.0, companyId: company.id },
    { id: "ing-carrot", name: "にんじん", storageType: StorageType.room, unit: "g", costPerUnit: 0.9, companyId: company.id },
    { id: "ing-potato", name: "じゃがいも", storageType: StorageType.room, unit: "g", costPerUnit: 1.0, companyId: company.id },
    { id: "ing-cabbage", name: "キャベツ", storageType: StorageType.room, unit: "g", costPerUnit: 0.8, companyId: company.id },
    { id: "ing-lettuce", name: "レタス", storageType: StorageType.room, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-tomato", name: "トマト", storageType: StorageType.room, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-spinach", name: "ほうれん草", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.2, companyId: company.id },
    { id: "ing-broccoli", name: "ブロッコリー", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.2, companyId: company.id },
    { id: "ing-eggplant", name: "なす", storageType: StorageType.room, unit: "g", costPerUnit: 1.8, companyId: company.id },
    { id: "ing-moyashi", name: "もやし", storageType: StorageType.chilled, unit: "g", costPerUnit: 0.5, companyId: company.id },
    { id: "ing-daikon", name: "大根", storageType: StorageType.room, unit: "g", costPerUnit: 0.6, companyId: company.id },
    { id: "ing-gobo", name: "ごぼう", storageType: StorageType.room, unit: "g", costPerUnit: 1.2, companyId: company.id },
    { id: "ing-kabocha", name: "かぼちゃ", storageType: StorageType.room, unit: "g", costPerUnit: 1.0, companyId: company.id },
    { id: "ing-shungiku", name: "春菊", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-okra", name: "オクラ", storageType: StorageType.chilled, unit: "g", costPerUnit: 3.0, companyId: company.id },
    { id: "ing-green-beans", name: "いんげん", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-cucumber", name: "きゅうり", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-bamboo-shoot", name: "たけのこ", storageType: StorageType.room, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-yamaimo", name: "山芋", storageType: StorageType.room, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-garlic", name: "にんにく", storageType: StorageType.room, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-ginger", name: "しょうが", storageType: StorageType.room, unit: "g", costPerUnit: 2.2, companyId: company.id },
    // === 主食・麺類 ===
    { id: "ing-rice", name: "米", storageType: StorageType.room, unit: "g", costPerUnit: 0.6, companyId: company.id },
    { id: "ing-udon", name: "うどん", storageType: StorageType.room, unit: "g", costPerUnit: 0.8, companyId: company.id },
    { id: "ing-spaghetti", name: "スパゲッティ", storageType: StorageType.room, unit: "g", costPerUnit: 0.75, companyId: company.id },
    { id: "ing-ramen-noodle", name: "中華麺", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.0, companyId: company.id },
    { id: "ing-yakisoba-noodle", name: "焼きそば麺", storageType: StorageType.chilled, unit: "g", costPerUnit: 0.8, companyId: company.id },
    { id: "ing-panko", name: "パン粉", storageType: StorageType.room, unit: "g", costPerUnit: 0.8, companyId: company.id },
    // === 調味料・その他 ===
    { id: "ing-miso", name: "味噌", storageType: StorageType.room, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-soy-sauce", name: "醤油", storageType: StorageType.room, unit: "g", costPerUnit: 1.4, companyId: company.id },
    { id: "ing-sugar", name: "砂糖", storageType: StorageType.room, unit: "g", costPerUnit: 0.5, companyId: company.id },
    { id: "ing-flour", name: "薄力粉", storageType: StorageType.room, unit: "g", costPerUnit: 0.6, companyId: company.id },
    { id: "ing-katakuriko", name: "片栗粉", storageType: StorageType.room, unit: "g", costPerUnit: 0.8, companyId: company.id },
    { id: "ing-cooking-oil", name: "サラダ油", storageType: StorageType.room, unit: "ml", costPerUnit: 0.4, companyId: company.id },
    { id: "ing-sesame-oil", name: "ごま油", storageType: StorageType.room, unit: "ml", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-sake-kasu", name: "酒粕", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-dashi", name: "だし", storageType: StorageType.room, unit: "g", costPerUnit: 3.0, companyId: company.id },
    // === 乳製品 ===
    { id: "ing-cheese", name: "チーズ", storageType: StorageType.chilled, unit: "g", costPerUnit: 5.5, companyId: company.id },
    { id: "ing-milk", name: "牛乳", storageType: StorageType.chilled, unit: "ml", costPerUnit: 0.25, companyId: company.id },
    { id: "ing-butter", name: "バター", storageType: StorageType.chilled, unit: "g", costPerUnit: 5.0, companyId: company.id },
    { id: "ing-cream", name: "生クリーム", storageType: StorageType.chilled, unit: "ml", costPerUnit: 1.2, companyId: company.id },
    { id: "ing-yogurt", name: "ヨーグルト", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.0, companyId: company.id },
    { id: "ing-mayonnaise", name: "マヨネーズ", storageType: StorageType.chilled, unit: "g", costPerUnit: 1.5, companyId: company.id },
    // === 缶詰・加工品 ===
    { id: "ing-canned-tomato", name: "トマト缶", storageType: StorageType.room, unit: "g", costPerUnit: 0.8, companyId: company.id },
    { id: "ing-curry-roux", name: "カレールー", storageType: StorageType.room, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-stew-roux", name: "シチュールー", storageType: StorageType.room, unit: "g", costPerUnit: 2.5, companyId: company.id },
    { id: "ing-kimchee", name: "キムチ", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-tsukemono", name: "漬物", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-nori", name: "海苔", storageType: StorageType.room, unit: "枚", costPerUnit: 10, companyId: company.id },
    { id: "ing-konbu-tsukudani", name: "昆布佃煮", storageType: StorageType.room, unit: "g", costPerUnit: 3.0, companyId: company.id },
    { id: "ing-komonago", name: "小女子佃煮", storageType: StorageType.room, unit: "g", costPerUnit: 4.0, companyId: company.id },
    { id: "ing-nimame", name: "煮豆", storageType: StorageType.chilled, unit: "g", costPerUnit: 2.0, companyId: company.id },
    { id: "ing-kiriboshi", name: "切り干し大根", storageType: StorageType.room, unit: "g", costPerUnit: 3.0, companyId: company.id },
    // === フルーツ ===
    { id: "ing-banana", name: "バナナ", storageType: StorageType.room, unit: "本", costPerUnit: 40, companyId: company.id },
    { id: "ing-melon", name: "メロン", storageType: StorageType.chilled, unit: "g", costPerUnit: 3.0, companyId: company.id },
    { id: "ing-suika", name: "スイカ", storageType: StorageType.room, unit: "g", costPerUnit: 1.5, companyId: company.id },
    { id: "ing-grapefruit", name: "グレープフルーツ", storageType: StorageType.room, unit: "個", costPerUnit: 120, companyId: company.id },
  ];

  await prisma.ingredient.createMany({ data: ingredients });

  // ========================================
  // Recipes (linked to company)
  // ========================================

  const recipes = [
    {
      id: "rec-teriyaki-chicken",
      name: "鶏の照り焼き",
      category: RecipeCategory.main,
      calories: 620,
      protein: 36,
      salt: 2.2,
      costPerServing: 520,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-chicken-thigh", amount: 180 },
        { ingredientId: "ing-onion", amount: 60 },
        { ingredientId: "ing-soy-sauce", amount: 20 },
        { ingredientId: "ing-rice", amount: 150 },
      ],
    },
    {
      id: "rec-miso-salmon",
      name: "サーモンの味噌焼き",
      category: RecipeCategory.main,
      calories: 540,
      protein: 32,
      salt: 2.0,
      costPerServing: 640,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-salmon", amount: 160 },
        { ingredientId: "ing-miso", amount: 25 },
        { ingredientId: "ing-rice", amount: 150 },
      ],
    },
    {
      id: "rec-ginger-pork",
      name: "豚の生姜焼き",
      category: RecipeCategory.main,
      calories: 650,
      protein: 34,
      salt: 2.6,
      costPerServing: 480,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-pork-belly", amount: 170 },
        { ingredientId: "ing-onion", amount: 50 },
        { ingredientId: "ing-ginger", amount: 12 },
        { ingredientId: "ing-rice", amount: 150 },
      ],
    },
    {
      id: "rec-curry-rice",
      name: "カレーライス",
      category: RecipeCategory.main,
      calories: 820,
      protein: 34,
      salt: 3.0,
      costPerServing: 520,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-rice", amount: 200 },
        { ingredientId: "ing-beef-slice", amount: 120 },
        { ingredientId: "ing-potato", amount: 90 },
        { ingredientId: "ing-carrot", amount: 60 },
        { ingredientId: "ing-onion", amount: 80 },
      ],
    },
    {
      id: "rec-miso-soup",
      name: "具だくさん味噌汁",
      category: RecipeCategory.soup,
      calories: 120,
      protein: 8,
      salt: 1.4,
      costPerServing: 120,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-tofu", amount: 60 },
        { ingredientId: "ing-carrot", amount: 40 },
        { ingredientId: "ing-onion", amount: 40 },
        { ingredientId: "ing-miso", amount: 18 },
      ],
    },
    {
      id: "rec-potato-salad",
      name: "ポテトサラダ",
      category: RecipeCategory.side,
      calories: 280,
      protein: 7,
      salt: 1.1,
      costPerServing: 180,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-potato", amount: 160 },
        { ingredientId: "ing-egg", amount: 1 },
        { ingredientId: "ing-onion", amount: 30 },
      ],
    },
    {
      id: "rec-tofu-salad",
      name: "豆腐サラダ",
      category: RecipeCategory.side,
      calories: 220,
      protein: 16,
      salt: 1.0,
      costPerServing: 220,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-tofu", amount: 140 },
        { ingredientId: "ing-lettuce", amount: 70 },
        { ingredientId: "ing-tomato", amount: 60 },
      ],
    },
    {
      id: "rec-minestrone",
      name: "ミネストローネ",
      category: RecipeCategory.soup,
      calories: 160,
      protein: 6,
      salt: 1.3,
      costPerServing: 160,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-tomato", amount: 140 },
        { ingredientId: "ing-carrot", amount: 50 },
        { ingredientId: "ing-onion", amount: 50 },
        { ingredientId: "ing-potato", amount: 60 },
      ],
    },
    {
      id: "rec-veg-stirfry",
      name: "野菜炒め",
      category: RecipeCategory.side,
      calories: 190,
      protein: 6,
      salt: 1.2,
      costPerServing: 160,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-cabbage", amount: 120 },
        { ingredientId: "ing-carrot", amount: 50 },
        { ingredientId: "ing-onion", amount: 40 },
      ],
    },
    {
      id: "rec-tonjiru",
      name: "豚汁",
      category: RecipeCategory.soup,
      calories: 260,
      protein: 14,
      salt: 1.8,
      costPerServing: 210,
      companyId: company.id,
      ingredients: [
        { ingredientId: "ing-pork-belly", amount: 90 },
        { ingredientId: "ing-potato", amount: 70 },
        { ingredientId: "ing-carrot", amount: 60 },
        { ingredientId: "ing-miso", amount: 20 },
      ],
    },
    // ========================================
    // 朝食メニュー（実際の船舶メニューより）
    // ========================================
    {
      id: "rec-natto", name: "納豆", category: RecipeCategory.side, calories: 100, protein: 8, salt: 0.6, costPerServing: 50, companyId: company.id, ingredients: [
        { ingredientId: "ing-natto", amount: 1 },
      ]
    },
    {
      id: "rec-raw-egg", name: "生卵", category: RecipeCategory.side, calories: 90, protein: 6, salt: 0.2, costPerServing: 30, companyId: company.id, ingredients: [
        { ingredientId: "ing-egg", amount: 1 },
      ]
    },
    {
      id: "rec-daikon-oroshi", name: "大根おろし", category: RecipeCategory.side, calories: 20, protein: 0, salt: 0.1, costPerServing: 30, companyId: company.id, ingredients: [
        { ingredientId: "ing-daikon", amount: 80 },
      ]
    },
    {
      id: "rec-komonago-tsukudani", name: "小女子佃煮", category: RecipeCategory.side, calories: 80, protein: 8, salt: 1.2, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-komonago", amount: 20 },
      ]
    },
    {
      id: "rec-hiraki-shishamo", name: "開きししゃも", category: RecipeCategory.main, calories: 140, protein: 12, salt: 1.0, costPerServing: 120, companyId: company.id, ingredients: [
        { ingredientId: "ing-shishamo", amount: 60 },
      ]
    },
    {
      id: "rec-scrambled-egg", name: "スクランブルエッグ", category: RecipeCategory.side, calories: 150, protein: 10, salt: 0.8, costPerServing: 80, companyId: company.id, ingredients: [
        { ingredientId: "ing-egg", amount: 2 },
        { ingredientId: "ing-butter", amount: 10 },
      ]
    },
    {
      id: "rec-himono", name: "干物（干魚）", category: RecipeCategory.main, calories: 180, protein: 22, salt: 1.5, costPerServing: 200, companyId: company.id, ingredients: [
        { ingredientId: "ing-himono", amount: 100 },
      ]
    },
    {
      id: "rec-dashimaki", name: "出し巻き卵", category: RecipeCategory.side, calories: 140, protein: 10, salt: 0.9, costPerServing: 100, companyId: company.id, ingredients: [
        { ingredientId: "ing-egg", amount: 2 },
        { ingredientId: "ing-dashi", amount: 10 },
      ]
    },
    {
      id: "rec-konbu-tsukudani", name: "昆布佃煮", category: RecipeCategory.side, calories: 60, protein: 2, salt: 1.4, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-konbu-tsukudani", amount: 20 },
      ]
    },
    {
      id: "rec-ajitsuke-nori", name: "味付けのり", category: RecipeCategory.side, calories: 20, protein: 2, salt: 0.8, costPerServing: 30, companyId: company.id, ingredients: [
        { ingredientId: "ing-nori", amount: 3 },
      ]
    },
    {
      id: "rec-nimame", name: "煮豆", category: RecipeCategory.side, calories: 120, protein: 6, salt: 0.5, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-nimame", amount: 50 },
      ]
    },
    {
      id: "rec-medamayaki", name: "目玉焼き", category: RecipeCategory.side, calories: 120, protein: 8, salt: 0.4, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-egg", amount: 1 },
        { ingredientId: "ing-cooking-oil", amount: 5 },
      ]
    },
    {
      id: "rec-yakizakana", name: "焼き魚", category: RecipeCategory.main, calories: 160, protein: 20, salt: 1.2, costPerServing: 180, companyId: company.id, ingredients: [
        { ingredientId: "ing-mackerel", amount: 100 },
      ]
    },
    {
      id: "rec-yogurt", name: "ヨーグルト", category: RecipeCategory.dessert, calories: 80, protein: 4, salt: 0.1, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-yogurt", amount: 100 },
      ]
    },
    {
      id: "rec-banana", name: "バナナ", category: RecipeCategory.dessert, calories: 90, protein: 1, salt: 0.0, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-banana", amount: 1 },
      ]
    },
    // ========================================
    // 昼食メニュー（実際の船舶メニューより）
    // ========================================
    {
      id: "rec-roast-beef", name: "ローストビーフ", category: RecipeCategory.main, calories: 320, protein: 28, salt: 1.8, costPerServing: 450, companyId: company.id, ingredients: [
        { ingredientId: "ing-beef-slice", amount: 150 },
        { ingredientId: "ing-onion", amount: 30 },
      ]
    },
    {
      id: "rec-moyashi-ohitashi", name: "もやしのお浸し", category: RecipeCategory.side, calories: 40, protein: 2, salt: 0.5, costPerServing: 30, companyId: company.id, ingredients: [
        { ingredientId: "ing-moyashi", amount: 100 },
        { ingredientId: "ing-soy-sauce", amount: 5 },
      ]
    },
    {
      id: "rec-tsukemono", name: "漬物", category: RecipeCategory.side, calories: 20, protein: 1, salt: 1.0, costPerServing: 30, companyId: company.id, ingredients: [
        { ingredientId: "ing-tsukemono", amount: 30 },
      ]
    },
    {
      id: "rec-suika", name: "スイカ", category: RecipeCategory.dessert, calories: 60, protein: 1, salt: 0.0, costPerServing: 80, companyId: company.id, ingredients: [
        { ingredientId: "ing-suika", amount: 150 },
      ]
    },
    {
      id: "rec-tofu-ankake", name: "豆腐あんかけ", category: RecipeCategory.main, calories: 180, protein: 12, salt: 1.2, costPerServing: 140, companyId: company.id, ingredients: [
        { ingredientId: "ing-tofu", amount: 200 },
        { ingredientId: "ing-katakuriko", amount: 10 },
        { ingredientId: "ing-dashi", amount: 10 },
      ]
    },
    {
      id: "rec-mozuku-su", name: "もずく酢", category: RecipeCategory.side, calories: 30, protein: 1, salt: 0.6, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-mozuku", amount: 50 },
      ]
    },
    {
      id: "rec-wakatakeni", name: "若竹煮", category: RecipeCategory.side, calories: 80, protein: 4, salt: 0.8, costPerServing: 100, companyId: company.id, ingredients: [
        { ingredientId: "ing-bamboo-shoot", amount: 80 },
        { ingredientId: "ing-wakame", amount: 10 },
      ]
    },
    {
      id: "rec-yakitori", name: "焼き鳥", category: RecipeCategory.main, calories: 280, protein: 24, salt: 1.6, costPerServing: 200, companyId: company.id, ingredients: [
        { ingredientId: "ing-chicken-thigh", amount: 150 },
        { ingredientId: "ing-soy-sauce", amount: 15 },
      ]
    },
    {
      id: "rec-macedoine-salad", name: "マセドアンサラダ", category: RecipeCategory.side, calories: 140, protein: 3, salt: 0.6, costPerServing: 100, companyId: company.id, ingredients: [
        { ingredientId: "ing-potato", amount: 60 },
        { ingredientId: "ing-carrot", amount: 30 },
        { ingredientId: "ing-mayonnaise", amount: 20 },
      ]
    },
    {
      id: "rec-spaghetti-meat", name: "スパゲティ・ミートソース", category: RecipeCategory.main, calories: 680, protein: 24, salt: 2.4, costPerServing: 320, companyId: company.id, ingredients: [
        { ingredientId: "ing-spaghetti", amount: 150 },
        { ingredientId: "ing-ground-beef", amount: 80 },
        { ingredientId: "ing-canned-tomato", amount: 100 },
        { ingredientId: "ing-onion", amount: 50 },
      ]
    },
    {
      id: "rec-ham-salad", name: "ハムサラダ", category: RecipeCategory.side, calories: 120, protein: 8, salt: 0.9, costPerServing: 100, companyId: company.id, ingredients: [
        { ingredientId: "ing-ham", amount: 40 },
        { ingredientId: "ing-lettuce", amount: 50 },
        { ingredientId: "ing-tomato", amount: 30 },
      ]
    },
    {
      id: "rec-nasu-itameni", name: "なすの炒め煮", category: RecipeCategory.side, calories: 100, protein: 2, salt: 0.7, costPerServing: 80, companyId: company.id, ingredients: [
        { ingredientId: "ing-eggplant", amount: 120 },
        { ingredientId: "ing-sesame-oil", amount: 10 },
      ]
    },
    {
      id: "rec-grapefruit", name: "グレープフルーツ", category: RecipeCategory.dessert, calories: 40, protein: 1, salt: 0.0, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-grapefruit", amount: 0.5 },
      ]
    },
    {
      id: "rec-karei-shioyaki", name: "かれい塩焼き", category: RecipeCategory.main, calories: 180, protein: 22, salt: 1.4, costPerServing: 280, companyId: company.id, ingredients: [
        { ingredientId: "ing-karei", amount: 120 },
      ]
    },
    {
      id: "rec-white-stew", name: "ホワイトシチュー", category: RecipeCategory.main, calories: 420, protein: 18, salt: 2.0, costPerServing: 340, companyId: company.id, ingredients: [
        { ingredientId: "ing-chicken-thigh", amount: 100 },
        { ingredientId: "ing-potato", amount: 80 },
        { ingredientId: "ing-carrot", amount: 50 },
        { ingredientId: "ing-stew-roux", amount: 30 },
        { ingredientId: "ing-milk", amount: 100 },
      ]
    },
    {
      id: "rec-karashi-ae", name: "辛子和え", category: RecipeCategory.side, calories: 60, protein: 4, salt: 0.6, costPerServing: 50, companyId: company.id, ingredients: [
        { ingredientId: "ing-spinach", amount: 80 },
      ]
    },
    {
      id: "rec-melon", name: "メロン", category: RecipeCategory.dessert, calories: 50, protein: 1, salt: 0.0, costPerServing: 120, companyId: company.id, ingredients: [
        { ingredientId: "ing-melon", amount: 100 },
      ]
    },
    {
      id: "rec-chahan", name: "炒飯（焼豚入り）", category: RecipeCategory.main, calories: 580, protein: 18, salt: 2.2, costPerServing: 280, companyId: company.id, ingredients: [
        { ingredientId: "ing-rice", amount: 200 },
        { ingredientId: "ing-chashu", amount: 50 },
        { ingredientId: "ing-egg", amount: 1 },
        { ingredientId: "ing-onion", amount: 30 },
      ]
    },
    {
      id: "rec-wakame-salad", name: "若芽サラダ", category: RecipeCategory.side, calories: 40, protein: 2, salt: 0.8, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-wakame", amount: 20 },
        { ingredientId: "ing-cucumber", amount: 40 },
      ]
    },
    {
      id: "rec-petit-tomato", name: "プチトマト", category: RecipeCategory.side, calories: 20, protein: 1, salt: 0.0, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-tomato", amount: 60 },
      ]
    },
    {
      id: "rec-omurice", name: "オムライス", category: RecipeCategory.main, calories: 620, protein: 20, salt: 2.0, costPerServing: 300, companyId: company.id, ingredients: [
        { ingredientId: "ing-rice", amount: 180 },
        { ingredientId: "ing-egg", amount: 2 },
        { ingredientId: "ing-chicken-thigh", amount: 60 },
        { ingredientId: "ing-onion", amount: 40 },
        { ingredientId: "ing-canned-tomato", amount: 50 },
      ]
    },
    {
      id: "rec-yakisoba", name: "焼きそば", category: RecipeCategory.main, calories: 520, protein: 16, salt: 2.4, costPerServing: 260, companyId: company.id, ingredients: [
        { ingredientId: "ing-yakisoba-noodle", amount: 180 },
        { ingredientId: "ing-pork-belly", amount: 60 },
        { ingredientId: "ing-cabbage", amount: 80 },
        { ingredientId: "ing-carrot", amount: 30 },
      ]
    },
    {
      id: "rec-ramen", name: "ラーメン", category: RecipeCategory.main, calories: 480, protein: 18, salt: 3.2, costPerServing: 280, companyId: company.id, ingredients: [
        { ingredientId: "ing-ramen-noodle", amount: 180 },
        { ingredientId: "ing-chashu", amount: 40 },
        { ingredientId: "ing-egg", amount: 0.5 },
        { ingredientId: "ing-moyashi", amount: 30 },
      ]
    },
    {
      id: "rec-oyakodon", name: "親子丼", category: RecipeCategory.main, calories: 580, protein: 28, salt: 2.2, costPerServing: 320, companyId: company.id, ingredients: [
        { ingredientId: "ing-rice", amount: 200 },
        { ingredientId: "ing-chicken-thigh", amount: 100 },
        { ingredientId: "ing-egg", amount: 2 },
        { ingredientId: "ing-onion", amount: 50 },
      ]
    },
    {
      id: "rec-katsudon", name: "カツ丼", category: RecipeCategory.main, calories: 820, protein: 32, salt: 2.8, costPerServing: 420, companyId: company.id, ingredients: [
        { ingredientId: "ing-rice", amount: 200 },
        { ingredientId: "ing-pork-loin", amount: 120 },
        { ingredientId: "ing-egg", amount: 1 },
        { ingredientId: "ing-panko", amount: 30 },
        { ingredientId: "ing-onion", amount: 40 },
      ]
    },
    // ========================================
    // 夕食メニュー（実際の船舶メニューより）
    // ========================================
    {
      id: "rec-hamachi-sashimi", name: "はまち刺身", category: RecipeCategory.main, calories: 180, protein: 24, salt: 0.8, costPerServing: 400, companyId: company.id, ingredients: [
        { ingredientId: "ing-hamachi-sashimi", amount: 100 },
      ]
    },
    {
      id: "rec-yakinasu", name: "焼き茄子", category: RecipeCategory.side, calories: 60, protein: 1, salt: 0.4, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-eggplant", amount: 120 },
      ]
    },
    {
      id: "rec-atsuage-kabocha", name: "厚揚げと南瓜の含め煮", category: RecipeCategory.side, calories: 180, protein: 8, salt: 0.9, costPerServing: 140, companyId: company.id, ingredients: [
        { ingredientId: "ing-atsuage", amount: 80 },
        { ingredientId: "ing-kabocha", amount: 80 },
      ]
    },
    {
      id: "rec-akadashi", name: "赤だし", category: RecipeCategory.soup, calories: 60, protein: 4, salt: 1.6, costPerServing: 80, companyId: company.id, ingredients: [
        { ingredientId: "ing-miso", amount: 20 },
        { ingredientId: "ing-tofu", amount: 50 },
      ]
    },
    {
      id: "rec-yamakake", name: "山かけ（まぐろ＋とろろ）", category: RecipeCategory.main, calories: 160, protein: 18, salt: 0.8, costPerServing: 360, companyId: company.id, ingredients: [
        { ingredientId: "ing-tuna-sashimi", amount: 80 },
        { ingredientId: "ing-yamaimo", amount: 80 },
      ]
    },
    {
      id: "rec-kasujiru", name: "粕汁", category: RecipeCategory.soup, calories: 140, protein: 8, salt: 1.4, costPerServing: 120, companyId: company.id, ingredients: [
        { ingredientId: "ing-sake-kasu", amount: 30 },
        { ingredientId: "ing-mackerel", amount: 40 },
        { ingredientId: "ing-daikon", amount: 50 },
      ]
    },
    {
      id: "rec-tempura", name: "天ぷら", category: RecipeCategory.main, calories: 380, protein: 16, salt: 1.2, costPerServing: 360, companyId: company.id, ingredients: [
        { ingredientId: "ing-shrimp", amount: 60 },
        { ingredientId: "ing-eggplant", amount: 40 },
        { ingredientId: "ing-flour", amount: 40 },
        { ingredientId: "ing-cooking-oil", amount: 30 },
      ]
    },
    {
      id: "rec-nikujaga", name: "牛肉とじゃがいもの煮物", category: RecipeCategory.main, calories: 340, protein: 18, salt: 1.8, costPerServing: 280, companyId: company.id, ingredients: [
        { ingredientId: "ing-beef-slice", amount: 100 },
        { ingredientId: "ing-potato", amount: 120 },
        { ingredientId: "ing-onion", amount: 50 },
        { ingredientId: "ing-soy-sauce", amount: 15 },
      ]
    },
    {
      id: "rec-morokyu", name: "もろきゅう", category: RecipeCategory.side, calories: 20, protein: 1, salt: 0.6, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-cucumber", amount: 80 },
        { ingredientId: "ing-miso", amount: 10 },
      ]
    },
    {
      id: "rec-shumai", name: "シュウマイ", category: RecipeCategory.main, calories: 240, protein: 12, salt: 1.4, costPerServing: 200, companyId: company.id, ingredients: [
        { ingredientId: "ing-ground-pork", amount: 100 },
        { ingredientId: "ing-onion", amount: 30 },
      ]
    },
    {
      id: "rec-shungiku-ohitashi", name: "春菊のお浸し", category: RecipeCategory.side, calories: 30, protein: 2, salt: 0.4, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-shungiku", amount: 80 },
      ]
    },
    {
      id: "rec-teppanyaki", name: "鉄板焼き", category: RecipeCategory.main, calories: 520, protein: 32, salt: 2.0, costPerServing: 480, companyId: company.id, ingredients: [
        { ingredientId: "ing-beef-slice", amount: 150 },
        { ingredientId: "ing-cabbage", amount: 80 },
        { ingredientId: "ing-moyashi", amount: 50 },
      ]
    },
    {
      id: "rec-katsuo-sashimi", name: "カツオの刺身", category: RecipeCategory.main, calories: 140, protein: 26, salt: 0.6, costPerServing: 380, companyId: company.id, ingredients: [
        { ingredientId: "ing-katsuo-sashimi", amount: 100 },
      ]
    },
    {
      id: "rec-namerou", name: "なめろう", category: RecipeCategory.main, calories: 160, protein: 18, salt: 1.2, costPerServing: 320, companyId: company.id, ingredients: [
        { ingredientId: "ing-katsuo-sashimi", amount: 80 },
        { ingredientId: "ing-miso", amount: 15 },
        { ingredientId: "ing-ginger", amount: 5 },
      ]
    },
    {
      id: "rec-fried-chicken", name: "フライドチキン", category: RecipeCategory.main, calories: 420, protein: 28, salt: 1.8, costPerServing: 280, companyId: company.id, ingredients: [
        { ingredientId: "ing-chicken-thigh", amount: 180 },
        { ingredientId: "ing-flour", amount: 30 },
        { ingredientId: "ing-cooking-oil", amount: 20 },
      ]
    },
    {
      id: "rec-arajiru", name: "あら汁", category: RecipeCategory.soup, calories: 100, protein: 12, salt: 1.6, costPerServing: 120, companyId: company.id, ingredients: [
        { ingredientId: "ing-fish-cake", amount: 60 },
        { ingredientId: "ing-daikon", amount: 50 },
        { ingredientId: "ing-miso", amount: 20 },
      ]
    },
    {
      id: "rec-gyoza", name: "餃子", category: RecipeCategory.main, calories: 320, protein: 14, salt: 1.6, costPerServing: 220, companyId: company.id, ingredients: [
        { ingredientId: "ing-ground-pork", amount: 80 },
        { ingredientId: "ing-cabbage", amount: 60 },
        { ingredientId: "ing-flour", amount: 40 },
      ]
    },
    {
      id: "rec-steak", name: "ステーキ", category: RecipeCategory.main, calories: 480, protein: 38, salt: 1.4, costPerServing: 600, companyId: company.id, ingredients: [
        { ingredientId: "ing-beef-slice", amount: 200 },
        { ingredientId: "ing-butter", amount: 15 },
      ]
    },
    {
      id: "rec-karaage", name: "唐揚げ", category: RecipeCategory.main, calories: 380, protein: 26, salt: 1.6, costPerServing: 260, companyId: company.id, ingredients: [
        { ingredientId: "ing-chicken-thigh", amount: 180 },
        { ingredientId: "ing-katakuriko", amount: 20 },
        { ingredientId: "ing-cooking-oil", amount: 20 },
      ]
    },
    // ========================================
    // 船員向け健康レシピ（WIB資料より）
    // ========================================
    {
      id: "rec-fish-kinoko-butter", name: "魚とキノコのバター蒸し", category: RecipeCategory.main, calories: 220, protein: 24, salt: 1.2, costPerServing: 320, companyId: company.id, ingredients: [
        { ingredientId: "ing-salmon", amount: 120 },
        { ingredientId: "ing-butter", amount: 15 },
      ]
    },
    {
      id: "rec-kiriboshi-daikon", name: "切り干し大根の煮物", category: RecipeCategory.side, calories: 80, protein: 3, salt: 0.8, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-kiriboshi", amount: 30 },
        { ingredientId: "ing-carrot", amount: 20 },
      ]
    },
    {
      id: "rec-nagaimo-tororo", name: "長芋のとろろ", category: RecipeCategory.side, calories: 80, protein: 3, salt: 0.6, costPerServing: 80, companyId: company.id, ingredients: [
        { ingredientId: "ing-yamaimo", amount: 100 },
      ]
    },
    {
      id: "rec-saba-misoni", name: "サバの味噌煮", category: RecipeCategory.main, calories: 320, protein: 22, salt: 2.0, costPerServing: 260, companyId: company.id, ingredients: [
        { ingredientId: "ing-mackerel", amount: 120 },
        { ingredientId: "ing-miso", amount: 25 },
        { ingredientId: "ing-ginger", amount: 10 },
      ]
    },
    {
      id: "rec-ingen-satsuma", name: "いんげんとさつま揚げの炒め物", category: RecipeCategory.side, calories: 120, protein: 6, salt: 0.8, costPerServing: 100, companyId: company.id, ingredients: [
        { ingredientId: "ing-green-beans", amount: 60 },
        { ingredientId: "ing-satsuma-age", amount: 40 },
      ]
    },
    {
      id: "rec-daikon-sunomono", name: "大根おろしの酢の物", category: RecipeCategory.side, calories: 30, protein: 1, salt: 0.4, costPerServing: 40, companyId: company.id, ingredients: [
        { ingredientId: "ing-daikon", amount: 100 },
      ]
    },
    {
      id: "rec-chirashizushi", name: "ちらし寿司", category: RecipeCategory.main, calories: 520, protein: 18, salt: 2.4, costPerServing: 380, companyId: company.id, ingredients: [
        { ingredientId: "ing-rice", amount: 200 },
        { ingredientId: "ing-shrimp", amount: 30 },
        { ingredientId: "ing-egg", amount: 1 },
      ]
    },
    {
      id: "rec-okra-ohitashi", name: "オクラのお浸し", category: RecipeCategory.side, calories: 25, protein: 2, salt: 0.4, costPerServing: 50, companyId: company.id, ingredients: [
        { ingredientId: "ing-okra", amount: 60 },
      ]
    },
    {
      id: "rec-sumashijiru", name: "すまし汁", category: RecipeCategory.soup, calories: 40, protein: 4, salt: 1.2, costPerServing: 60, companyId: company.id, ingredients: [
        { ingredientId: "ing-dashi", amount: 10 },
        { ingredientId: "ing-tofu", amount: 40 },
        { ingredientId: "ing-wakame", amount: 5 },
      ]
    },
  ];

  for (const recipe of recipes) {
    const { ingredients: ingList, ...rest } = recipe;
    await prisma.recipe.create({
      data: {
        ...rest,
        ingredients: { create: ingList },
      },
    });
  }

  // ========================================
  // MenuPlans (linked to vessel)
  // ========================================

  const menuPlans = [
    {
      id: "plan-2024-12-06-dinner",
      date: "2024-12-06",
      mealType: MealType.dinner,
      healthScore: 82,
      vesselId: vessel1.id,
      recipeIds: ["rec-teriyaki-chicken", "rec-miso-soup", "rec-potato-salad"],
    },
    {
      id: "plan-2024-12-07-lunch",
      date: "2024-12-07",
      mealType: MealType.lunch,
      healthScore: 78,
      vesselId: vessel1.id,
      recipeIds: ["rec-miso-salmon", "rec-tofu-salad", "rec-minestrone"],
    },
    {
      id: "plan-2024-12-08-dinner",
      date: "2024-12-08",
      mealType: MealType.dinner,
      healthScore: 75,
      vesselId: vessel1.id,
      recipeIds: ["rec-ginger-pork", "rec-veg-stirfry", "rec-tonjiru"],
    },
  ];

  for (const plan of menuPlans) {
    await prisma.menuPlan.create({
      data: {
        id: plan.id,
        date: plan.date,
        mealType: plan.mealType,
        healthScore: plan.healthScore,
        vesselId: plan.vesselId,
        recipeLinks: {
          create: plan.recipeIds.map((recipeId) => ({ recipeId })),
        },
      },
    });
  }

  // ========================================
  // MealFeedbacks (充実版 - 過去7日間)
  // ========================================

  // 過去7日間の日付を生成
  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const feedbacks = [
    // Day -6
    { date: dates[0], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "照り焼きが好評でした" },
    { date: dates[0], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[0], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 4, volumeFeeling: VolumeFeeling.much, leftover: LeftoverAmount.half, comment: "量が多かった" },
    // Day -5
    { date: dates[1], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 3, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "もう少し塩味が欲しい" },
    { date: dates[1], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew3.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[1], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "カレーが美味しかった！" },
    // Day -4
    { date: dates[2], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[2], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "刺身が新鮮で良かった" },
    { date: dates[2], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 4, volumeFeeling: VolumeFeeling.less, leftover: LeftoverAmount.none, comment: "もう少し量が欲しい" },
    // Day -3
    { date: dates[3], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 3, volumeFeeling: VolumeFeeling.much, leftover: LeftoverAmount.half, comment: "揚げ物が多い" },
    { date: dates[3], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[3], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew3.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "豚汁が温まった" },
    // Day -2
    { date: dates[4], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[4], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "おいしかったです" },
    { date: dates[4], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "ステーキ最高！" },
    // Day -1
    { date: dates[5], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    { date: dates[5], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew3.id, satisfaction: 3, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "野菜がもう少し欲しい" },
    { date: dates[5], mealType: MealType.dinner, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    // Today
    { date: dates[6], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew1.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "とても美味しかったです！" },
    { date: dates[6], mealType: MealType.lunch, vesselId: vessel1.id, crewMemberId: crew2.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
    // 光丸の船員も
    { date: dates[5], mealType: MealType.lunch, vesselId: vessel2.id, crewMemberId: crew4.id, satisfaction: 4, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: "良かった" },
    { date: dates[6], mealType: MealType.lunch, vesselId: vessel2.id, crewMemberId: crew4.id, satisfaction: 5, volumeFeeling: VolumeFeeling.just, leftover: LeftoverAmount.none, comment: null },
  ];

  await prisma.mealFeedback.createMany({ data: feedbacks });

  console.log("✅ Seed completed successfully!");
  console.log("");
  console.log("📧 Demo accounts:");
  console.log("   現場側(司厨):   chef@demo.wellship.jp / demo1234");
  console.log("   管理側(本部):   manager@demo.wellship.jp / demo1234");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
