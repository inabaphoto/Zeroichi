const { createClient } = require('@supabase/supabase-js');

const url = 'https://ypwegshakepxgpiqsbhx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd2Vnc2hha2VweGdwaXFzYmh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg0NzkxOCwiZXhwIjoyMDc0NDIzOTE4fQ.jkpJl28bbpcwvJII4f_ZlEQ0YWDb2N9xZWOjrk1xkfw';

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function fixAuthUsers() {
  console.log('Attempting to fix auth configuration...');

  // Get user from database directly
  console.log('Step 1: Getting user from database...');
  const { data: users, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'info@photo-innovation.net')
    .single();

  if (dbError) {
    console.error('Error getting user from DB:', dbError);
    return;
  }

  console.log('User found in database:', users);

  // Try to update password directly
  console.log('\nStep 2: Attempting to update password directly...');
  const newPassword = 'ZeroichiAdmin2025!@#';

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(
      users.id,
      { password: newPassword }
    );

    if (error) {
      console.error('Error updating password:', error);

      // Alternative: Try creating a new user with the same email
      console.log('\nStep 3: Alternative approach - recreate user...');

      // First, try to delete the existing user
      console.log('Attempting to delete existing user...');
      const { error: deleteError } = await supabase.auth.admin.deleteUser(users.id);

      if (deleteError) {
        console.error('Could not delete user:', deleteError);
      } else {
        console.log('User deleted successfully');

        // Now create a new user
        console.log('Creating new user...');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: 'info@photo-innovation.net',
          password: newPassword,
          email_confirm: true,
          user_metadata: {
            role: 'admin'
          }
        });

        if (createError) {
          console.error('Error creating new user:', createError);
        } else {
          console.log('New user created:', newUser.user);
        }
      }
    } else {
      console.log('Password updated successfully:', data);
    }
  } catch (e) {
    console.error('Exception:', e.message);
  }

  // Verify the result
  console.log('\nStep 4: Verifying result...');
  const { data: finalUsers, error: finalError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100
  });

  if (finalError) {
    console.error('Error listing users:', finalError);
  } else {
    console.log(`Total users after operation: ${finalUsers.users.length}`);
    finalUsers.users.forEach(u => {
      console.log(`- ${u.id}: ${u.email}`);
    });
  }
}

fixAuthUsers().catch(console.error);