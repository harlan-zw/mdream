<template>
  <div class="about">
    <h1>About Us</h1>
    <p>Welcome to our amazing company! We are passionate about creating innovative solutions that make a difference in the world.</p>

    <section>
      <h2>Our Mission</h2>
      <p>To provide high-quality products and services that exceed our customers' expectations while maintaining the highest standards of integrity and professionalism.</p>
    </section>

    <section>
      <h2>Our Team</h2>
      <div class="team-grid">
        <div class="team-member">
          <h3>John Doe</h3>
          <p><strong>CEO & Founder</strong></p>
          <p>John has over 15 years of experience in technology and business development.</p>
        </div>
        <div class="team-member">
          <h3>Jane Smith</h3>
          <p><strong>Chief Technology Officer</strong></p>
          <p>Jane leads our technical team with expertise in software architecture and development.</p>
        </div>
        <div class="team-member">
          <h3>Mike Johnson</h3>
          <p><strong>Head of Design</strong></p>
          <p>Mike brings creativity and user-centered design thinking to all our projects.</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Our Values</h2>
      <ul>
        <li><strong>Innovation:</strong> We constantly push the boundaries of what's possible</li>
        <li><strong>Quality:</strong> We never compromise on the quality of our work</li>
        <li><strong>Collaboration:</strong> We believe in the power of teamwork</li>
        <li><strong>Integrity:</strong> We conduct business with honesty and transparency</li>
      </ul>
    </section>

    <blockquote>
      "Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill
    </blockquote>
  </div>
</template>

<style scoped>
.about {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.6;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.team-member {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
}

.team-member h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

section {
  margin: 2rem 0;
}

blockquote {
  background: #f9f9f9;
  border-left: 4px solid #ccc;
  margin: 2rem 0;
  padding: 1rem 2rem;
  font-style: italic;
}

ul {
  margin: 1rem 0;
}

li {
  margin: 0.5rem 0;
}
</style>
