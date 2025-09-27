const { createClient } = require('@supabase/supabase-js');

const url = 'https://ypwegshakepxgpiqsbhx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd2Vnc2hha2VweGdwaXFzYmh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg0NzkxOCwiZXhwIjoyMDc0NDIzOTE4fQ.jkpJl28bbpcwvJII4f_ZlEQ0YWDb2N9xZWOjrk1xkfw';

async function checkAuthSchema() {
  console.log('Checking database schemas...\n');

  // Create client for public schema
  const publicClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });

  // Check public.users table
  console.log('1. Checking public.users table:');
  const { data: publicUsers, error: publicError } = await publicClient
    .from('users')
    .select('*')
    .limit(5);

  if (publicError) {
    console.error('Error:', publicError.message);
  } else {
    console.log(`Found ${publicUsers?.length || 0} users in public.users`);
    publicUsers?.forEach(u => console.log(`  - ${u.id}: ${u.email}`));
  }

  console.log('\n2. Using Auth Admin API to create proper auth user:');

  // Use auth admin to create user in auth.users
  const { data: createdUser, error: createError } = await publicClient.auth.admin.createUser({
    email: 'info@photo-innovation.net',
    password: 'ZeroichiAdmin2025!@#',
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      display_name: 'Photo Innovation Admin'
    }
  });

  if (createError) {
    console.error('Error creating auth user:', createError.message);

    // If user exists, try different email
    if (createError.message.includes('already been registered')) {
      console.log('\n3. User already exists in auth.users, trying to list users:');
      const { data: authUsers, error: listError } = await publicClient.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing auth users:', listError.message);
      } else {
        console.log(`Found ${authUsers?.users?.length || 0} users in auth.users`);
        authUsers?.users?.forEach(u => console.log(`  - ${u.id}: ${u.email}`));
      }
    }
  } else {
    console.log('Auth user created successfully:', createdUser?.user?.email);
    console.log('User ID:', createdUser?.user?.id);
  }

  console.log('\n4. Final check - List all auth users:');
  const { data: finalUsers, error: finalError } = await publicClient.auth.admin.listUsers();
  if (finalError) {
    console.error('Error:', finalError.message);
  } else {
    console.log(`Total users in auth.users: ${finalUsers?.users?.length || 0}`);
    finalUsers?.users?.forEach(u => {
      console.log(`  - ${u.id}: ${u.email} (created: ${u.created_at})`);
    });
  }
}

checkAuthSchema().catch(console.error);