import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { features } from '@/lib/config/features';

// 画像アップロードAPI（PoC用ローカル保存）
export async function POST(request: NextRequest) {
    // Feature flag check: Return 403 if photo feedback is disabled
    if (!features.photoFeedback) {
        return NextResponse.json(
            { error: 'Photo feedback is disabled in MVP configuration' },
            { status: 403 }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get('photo') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: '画像ファイルが必要です。' },
                { status: 400 }
            );
        }

        // ファイルタイプ検証
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { error: '画像ファイルのみ対応しています。' },
                { status: 400 }
            );
        }

        // サイズ制限（5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'ファイルサイズは5MB以下にしてください。' },
                { status: 400 }
            );
        }

        // ファイル名生成
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = file.type === 'image/png' ? 'png' : 'jpg';
        const filename = `${timestamp}_${random}.${ext}`;

        // 保存先ディレクトリ
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'feedback');

        // ディレクトリが存在しない場合は作成
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // ファイル保存
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // 公開URL
        const photoUrl = `/uploads/feedback/${filename}`;

        return NextResponse.json({
            success: true,
            photoUrl,
        });
    } catch (error) {
        console.error('Photo upload error:', error);
        return NextResponse.json(
            { error: '画像のアップロードに失敗しました。' },
            { status: 500 }
        );
    }
}
