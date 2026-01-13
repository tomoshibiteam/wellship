import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * MVP用デモアカウント作成API
 * 開発環境でのみ使用可能
 */
export async function POST() {
    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        const supabase = await createSupabaseServerClient();

        // 1. 会社の確認・作成
        const companySlug = 'demo-shipping';
        let company = await supabase
            .from('Company')
            .select('*')
            .eq('slug', companySlug)
            .maybeSingle();

        if (!company.data) {
            const { data: newCompany, error: companyError } = await supabase
                .from('Company')
                .insert({
                    id: 'company-demo',
                    name: 'デモ船会社',
                    slug: companySlug,
                })
                .select()
                .single();

            if (companyError) throw companyError;
            company.data = newCompany;
        }

        const companyId = company.data!.id;

        // 2. 船舶の確認・作成
        const vesselId = 'vessel-sakura';
        let vessel = await supabase
            .from('Vessel')
            .select('*')
            .eq('id', vesselId)
            .maybeSingle();

        if (!vessel.data) {
            const { data: newVessel, error: vesselError } = await supabase
                .from('Vessel')
                .insert({
                    id: vesselId,
                    name: '桜丸',
                    imoNumber: 'IMO1234567',
                    companyId,
                })
                .select()
                .single();

            if (vesselError) throw vesselError;
            vessel.data = newVessel;
        }

        // 3. マネージャー（佐藤さん）の作成
        const managerEmail = 'sato@wellship.demo';
        let manager = await supabase
            .from('User')
            .select('*')
            .eq('email', managerEmail)
            .maybeSingle();

        if (!manager.data) {
            const { data: newManager, error: managerError } = await supabase
                .from('User')
                .insert({
                    email: managerEmail,
                    name: '佐藤',
                    role: 'MANAGER',
                    companyId,
                })
                .select()
                .single();

            if (managerError) throw managerError;
            manager.data = newManager;

            // 船舶に紐付け
            await supabase.from('UserVesselMembership').insert({
                userId: newManager.id,
                vesselId,
                role: 'MANAGER',
            });
        }

        // 4. 司厨（山田さん）の作成
        const chefEmail = 'yamada@wellship.demo';
        let chef = await supabase
            .from('User')
            .select('*')
            .eq('email', chefEmail)
            .maybeSingle();

        if (!chef.data) {
            const { data: newChef, error: chefError } = await supabase
                .from('User')
                .insert({
                    email: chefEmail,
                    name: '山田',
                    role: 'CHEF',
                    companyId,
                })
                .select()
                .single();

            if (chefError) throw chefError;
            chef.data = newChef;

            // 船舶に紐付け
            await supabase.from('UserVesselMembership').insert({
                userId: newChef.id,
                vesselId,
                role: 'CHEF',
            });
        }

        // 5. 船員9名の作成
        const crewNames = [
            '田中', '鈴木', '高橋', '渡辺', '伊藤',
            '中村', '小林', '加藤', '吉田'
        ];

        const crewResults = [];
        for (let i = 0; i < crewNames.length; i++) {
            const cardCode = `CREW-${String(i + 1).padStart(3, '0')}`;

            const existing = await supabase
                .from('CrewMember')
                .select('*')
                .eq('cardCode', cardCode)
                .maybeSingle();

            if (!existing.data) {
                const { data: newCrew } = await supabase
                    .from('CrewMember')
                    .insert({
                        name: crewNames[i],
                        cardCode,
                        vesselId,
                    })
                    .select()
                    .single();

                crewResults.push(newCrew);
            } else {
                crewResults.push(existing.data);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                company: company.data,
                vessel: vessel.data,
                manager: manager.data,
                chef: chef.data,
                crew: crewResults,
            },
            message: 'デモアカウントを作成しました',
        });
    } catch (error) {
        console.error('Seed error:', error);
        return NextResponse.json(
            { error: 'Failed to create demo accounts', details: error },
            { status: 500 }
        );
    }
}
