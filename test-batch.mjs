// Debug script to check frontend state and API responses
console.log('=== Frontend Debug Analysis ===');

// Check if the batch results files are accessible
const testBatchFile = async () => {
  try {
    const response = await fetch('http://localhost:9754/batch-results/batch_batch_1760621842705_amr0df6lo_2025-10-16T13-38-03-725Z.json');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Batch file accessible via API');
      console.log('   - Job ID:', data.jobId);
      console.log('   - Summary:', data.summary);
      console.log('   - Results count:', data.results?.length || 0);
      console.log('   - Sample result has detections:', 
        (data.results?.[0]?.persons?.length || 0) > 0 || (data.results?.[0]?.faces?.length || 0) > 0);
      return true;
    }
  } catch (error) {
    console.log('❌ Batch file not accessible:', error.message);
    return false;
  }
};

// Check API endpoint
const testAPIEndpoint = async () => {
  try {
    const response = await fetch('http://localhost:9754/api/batch/jobs/batch_1760621842705_amr0df6lo/results');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint working');
      console.log('   - Success:', data.success);
      console.log('   - Has results:', !!data.results);
      console.log('   - Results summary:', data.results?.summary);
      console.log('   - Results count:', data.results?.results?.length || 0);
      return true;
    } else {
      console.log('❌ API returned error:', response.status);
    }
  } catch (error) {
    console.log('❌ API endpoint error:', error.message);
    return false;
  }
};

// Run tests
(async () => {
  console.log('Starting analysis...');
  
  const fileAccessible = await testBatchFile();
  const apiWorking = await testAPIEndpoint();
  
  console.log('\n=== Analysis Results ===');
  console.log('Batch file accessible:', fileAccessible);
  console.log('API endpoint working:', apiWorking);
  
  if (fileAccessible && apiWorking) {
    console.log('✅ Backend is working correctly');
    console.log('❌ Issue is likely in frontend state management');
    console.log('');
    console.log('Common frontend issues:');
    console.log('1. viewingResultsJobId state not being set');
    console.log('2. batchResultsData state not being set');
    console.log('3. Component rendering condition failing');
    console.log('4. State management bug in handleViewResults');
  } else {
    console.log('❌ Backend issue detected');
  }
})();