const { createClient } = require('@supabase/supabase-js');

const url = 'https://ypwegshakepxgpiqsbhx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd2Vnc2hha2VweGdwaXFzYmh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg0NzkxOCwiZXhwIjoyMDc0NDIzOTE4fQ.jkpJl28bbpcwvJII4f_ZlEQ0YWDb2N9xZWOjrk1xkfw';

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSupabase() {
  console.log('Testing Supabase connection...');
  console.log('URL:', url);
  console.log('SRK prefix:', serviceRoleKey.substring(0, 50) + '...');
  console.log('---');

  // Test 1: List users
  console.log('Test 1: Listing users...');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100
    });

    if (error) {
      console.error('Error listing users:', error);
    } else {
      console.log(`Found ${users?.users?.length || 0} users`);
      if (users?.users?.length > 0) {
        users.users.forEach(user => {
          console.log(`- ${user.id}: ${user.email}`);
        });
      }
    }
  } catch (e) {
    console.error('Exception listing users:', e.message);
  }

  console.log('---');

  // Test 2: Get specific user
  const targetUserId = '9839eb6f-3d8b-42fe-9d5a-cc5c7dfd86a1';
  console.log(`Test 2: Getting user ${targetUserId}...`);
  try {
    const { data, error } = await supabase.auth.admin.getUserById(targetUserId);

    if (error) {
      console.error('Error getting user:', error);
    } else if (data?.user) {
      console.log('User found:', {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      });
    } else {
      console.log('User not found');
    }
  } catch (e) {
    console.error('Exception getting user:', e.message);
  }

  console.log('---');

  // Test 3: Direct database query
  console.log('Test 3: Direct database query to auth.users...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .limit(10);

    if (error) {
      console.error('Error querying database:', error);
    } else {
      console.log(`Database query returned ${data?.length || 0} rows`);
      if (data?.length > 0) {
        data.forEach(row => {
          console.log(`- ${row.id}: ${row.email}`);
        });
      }
    }
  } catch (e) {
    console.error('Exception querying database:', e.message);
  }

  console.log('---');

  // Test 4: Create test user
  console.log('Test 4: Creating test user...');
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test-' + Date.now() + '@example.com',
      password: 'TestPassword123!',
      email_confirm: true
    });

    if (error) {
      console.error('Error creating user:', error);
    } else if (data?.user) {
      console.log('User created:', {
        id: data.user.id,
        email: data.user.email
      });

      // Try to delete the test user
      console.log('Cleaning up test user...');
      const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
      if (deleteError) {
        console.error('Error deleting test user:', deleteError);
      } else {
        console.log('Test user deleted');
      }
    }
  } catch (e) {
    console.error('Exception creating user:', e.message);
  }

  console.log('---');
  console.log('Tests complete');
}

testSupabase().catch(console.error);