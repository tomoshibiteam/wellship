/**
 * MVP用デモアカウント作成スクリプト
 * 
 * 実行方法:
 *   npx tsx prisma/seed-demo-accounts.ts
 * 
 * 作成されるアカウント:
 * - 佐藤さん (MANAGER): sato@wellship.demo
 * - 山田さん (CHEF): yamada@wellship.demo
 */

// 環境変数を最初に読み込む
import { configDotenv } from 'dotenv';
import { join } from 'path';

configDotenv({ path: join(__dirname, '../.env.local') });

// 環境変数読み込み後にPrismaClientをインポート
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 MVP用デモアカウント作成を開始...\n');

    // 1. 会社の確認・作成
    const companySlug = 'demo-shipping';
    let company = await prisma.company.findUnique({
        where: { slug: companySlug },
    });

    if (!company) {
        company = await prisma.company.create({
            data: {
                id: 'company-demo',
                name: 'デモ船会社',
                slug: companySlug,
            },
        });
        console.log('✅ 会社を作成しました:', company.name);
    } else {
        console.log('📌 既存の会社を使用:', company.name);
    }

    // 2. 船舶の確認・作成
    const vesselId = 'vessel-sakura';
    let vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
    });

    if (!vessel) {
        vessel = await prisma.vessel.create({
            data: {
                id: vesselId,
                name: '桜丸',
                imoNumber: 'IMO1234567',
                companyId: company.id,
            },
        });
        console.log('✅ 船舶を作成しました:', vessel.name);
    } else {
        console.log('📌 既存の船舶を使用:', vessel.name);
    }

    // 3. マネージャー（佐藤さん）の作成
    const managerEmail = 'sato@wellship.demo';
    let manager = await prisma.user.findUnique({
        where: { email: managerEmail },
    });

    if (!manager) {
        manager = await prisma.user.create({
            data: {
                email: managerEmail,
                name: '佐藤',
                role: 'MANAGER',
                companyId: company.id,
            },
        });
        console.log('✅ マネージャーを作成しました:', manager.name, `(${manager.email})`);
    } else {
        console.log('📌 既存のマネージャーを使用:', manager.name, `(${manager.email})`);
    }

    // マネージャーを船舶に紐付け
    const managerMembership = await prisma.userVesselMembership.findFirst({
        where: { userId: manager.id, vesselId: vessel.id },
    });
    if (!managerMembership) {
        await prisma.userVesselMembership.create({
            data: {
                userId: manager.id,
                vesselId: vessel.id,
                role: 'MANAGER',
            },
        });
        console.log('  → 船舶に紐付けました');
    }

    // 4. 司厨（山田さん）の作成
    const chefEmail = 'yamada@wellship.demo';
    let chef = await prisma.user.findUnique({
        where: { email: chefEmail },
    });

    if (!chef) {
        chef = await prisma.user.create({
            data: {
                email: chefEmail,
                name: '山田',
                role: 'CHEF',
                companyId: company.id,
            },
        });
        console.log('✅ 司厨を作成しました:', chef.name, `(${chef.email})`);
    } else {
        console.log('📌 既存の司厨を使用:', chef.name, `(${chef.email})`);
    }

    // 司厨を船舶に紐付け
    const chefMembership = await prisma.userVesselMembership.findFirst({
        where: { userId: chef.id, vesselId: vessel.id },
    });
    if (!chefMembership) {
        await prisma.userVesselMembership.create({
            data: {
                userId: chef.id,
                vesselId: vessel.id,
                role: 'CHEF',
            },
        });
        console.log('  → 船舶に紐付けました');
    }

    // 5. 船員9名の作成
    console.log('\n👥 船員の作成...');
    const crewNames = [
        '田中', '鈴木', '高橋', '渡辺', '伊藤',
        '中村', '小林', '加藤', '吉田'
    ];

    for (let i = 0; i < crewNames.length; i++) {
        const cardCode = `CREW-${String(i + 1).padStart(3, '0')}`;
        const existing = await prisma.crewMember.findUnique({
            where: { cardCode },
        });

        if (!existing) {
            await prisma.crewMember.create({
                data: {
                    name: crewNames[i],
                    cardCode,
                    vesselId: vessel.id,
                },
            });
            console.log(`  ✅ 船員を作成: ${crewNames[i]}さん (${cardCode})`);
        } else {
            console.log(`  📌 既存の船員: ${existing.name}さん (${cardCode})`);
        }
    }

    console.log('\n========================================');
    console.log('📋 MVP環境 サマリー');
    console.log('========================================');
    console.log(`🏢 会社: ${company.name}`);
    console.log(`🚢 船舶: ${vessel.name}`);
    console.log(`👔 マネージャー: ${manager.name} (${manager.email})`);
    console.log(`👨‍🍳 司厨: ${chef.name} (${chef.email})`);
    console.log(`👥 船員: ${crewNames.length}名`);
    console.log('========================================\n');

    console.log('✨ デモアカウント作成完了！\n');
    console.log('💡 ヒント: 開発者アカウント（wataru.1998.0606@gmail.com）でログイン後、');
    console.log('   ヘッダーのロール切り替えボタンで司厨/マネージャーを切り替えられます。');
    console.log('   表示名は自動的に佐藤/山田に変わります。\n');
}

main()
    .catch((e) => {
        console.error('❌ エラーが発生しました:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
