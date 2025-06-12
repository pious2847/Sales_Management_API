const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Determine which MongoDB URI to use based on environment
    const mongoURI = process.env.NODE_ENV === 'production'
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI_DEV;

    if (!mongoURI) {
      console.warn('⚠️ MongoDB URI is not defined in environment variables');
      console.log('📝 Available environment variables:');
      console.log('   - NODE_ENV:', process.env.NODE_ENV);
      console.log('   - MONGODB_URI_DEV:', process.env.MONGODB_URI_DEV ? 'Set' : 'Not set');
      console.log('   - MONGODB_URI_PROD:', process.env.MONGODB_URI_PROD ? 'Set' : 'Not set');
      console.log('📝 Server will start without database connection');
      return;
    }

    console.log(`🔗 Attempting to connect to MongoDB...`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📍 Database URI: ${mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 10000 : 5000, // Longer timeout for production
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5, // Maintain up to 10 socket connections in production
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Attempting to reconnect...');
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ Database connection failed: ${error.message}`);

    // Provide specific error guidance
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 DNS Resolution Error - Check your connection string and network connectivity');
      console.log('   - Verify the cluster hostname is correct');
      console.log('   - Ensure your IP address is whitelisted in MongoDB Atlas');
      console.log('   - Check if special characters in password are URL encoded');
    } else if (error.message.includes('authentication failed')) {
      console.log('💡 Authentication Error - Check your username and password');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Connection Timeout - Check your network connectivity');
    }

    console.log('📝 Server will continue without database connection');

    // In production, we might want to exit if database is critical
    if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_DB === 'true') {
      console.error('🚨 Database is required in production. Exiting...');
      process.exit(1);
    }
  }
};

module.exports = connectDB;
