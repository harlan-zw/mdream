<script setup>
import { ref } from 'vue'

const form = ref({
  name: '',
  email: '',
  subject: '',
  message: '',
})

function submitForm() {
  // In a real app, this would send the form data to a server
  alert('Thank you for your message! We will get back to you soon.')

  // Reset form
  form.value = {
    name: '',
    email: '',
    subject: '',
    message: '',
  }
}
</script>

<template>
  <div class="contact">
    <h1>Contact Us</h1>
    <p>We'd love to hear from you! Get in touch with us using any of the methods below.</p>

    <div class="contact-grid">
      <section class="contact-info">
        <h2>Get in Touch</h2>

        <div class="contact-method">
          <h3>📧 Email</h3>
          <p><a href="mailto:hello@company.com">hello@company.com</a></p>
          <p><a href="mailto:support@company.com">support@company.com</a></p>
        </div>

        <div class="contact-method">
          <h3>📱 Phone</h3>
          <p>Main: <a href="tel:+1234567890">+1 (234) 567-890</a></p>
          <p>Support: <a href="tel:+1234567891">+1 (234) 567-891</a></p>
        </div>

        <div class="contact-method">
          <h3>🏢 Address</h3>
          <address>
            123 Business Street<br>
            Suite 100<br>
            Tech City, TC 12345<br>
            United States
          </address>
        </div>

        <div class="contact-method">
          <h3>🕒 Business Hours</h3>
          <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
          <p>Saturday: 10:00 AM - 4:00 PM</p>
          <p>Sunday: Closed</p>
        </div>
      </section>

      <section class="contact-form">
        <h2>Send us a Message</h2>
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label for="name">Name *</label>
            <input id="name" v-model="form.name" type="text" required>
          </div>

          <div class="form-group">
            <label for="email">Email *</label>
            <input id="email" v-model="form.email" type="email" required>
          </div>

          <div class="form-group">
            <label for="subject">Subject *</label>
            <input id="subject" v-model="form.subject" type="text" required>
          </div>

          <div class="form-group">
            <label for="message">Message *</label>
            <textarea id="message" v-model="form.message" rows="5" required />
          </div>

          <button type="submit" class="submit-btn">
            Send Message
          </button>
        </form>
      </section>
    </div>

    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item">
        <h3>What are your response times?</h3>
        <p>We typically respond to emails within 24 hours during business days. For urgent matters, please call our main number.</p>
      </div>
      <div class="faq-item">
        <h3>Do you offer technical support?</h3>
        <p>Yes! Our technical support team is available via email at support@company.com or through our dedicated support phone line.</p>
      </div>
      <div class="faq-item">
        <h3>Can I schedule a meeting?</h3>
        <p>Absolutely! Please email us with your preferred time and we'll coordinate a meeting that works for everyone.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.contact {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.6;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin: 2rem 0;
}

.contact-method {
  margin: 2rem 0;
}

.contact-method h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.contact-method p {
  margin: 0.25rem 0;
}

.contact-method a {
  color: #007bff;
  text-decoration: none;
}

.contact-method a:hover {
  text-decoration: underline;
}

address {
  font-style: normal;
  line-height: 1.5;
}

.form-group {
  margin: 1rem 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.submit-btn {
  background: #007bff;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.submit-btn:hover {
  background: #0056b3;
}

.faq {
  margin: 3rem 0;
}

.faq-item {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.faq-item h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.faq-item p {
  margin: 0;
}

@media (max-width: 768px) {
  .contact-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
