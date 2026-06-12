module.exports = {
  pro: {
    redeem: {
      guild_only: "This command can only be used inside a server.",
      owner_only: "Only the server owner can redeem PRO codes.",
      success_title: "✅ PRO Activated Successfully!",
      success_description: "Your code `{{code}}` has been redeemed successfully.\n\nYou now have **{{plan}}** access to all premium features!",
      lifetime_access: "🌟 You have **lifetime** PRO access!",
      expires_at: "Your PRO access is valid until {{date}}.",
      extended: "Your subscription has been extended.",
      duration_label: "Duration",
      server_label: "Server",
      lifetime: "Lifetime",
      days: "{{days}} days",
      error_title: "❌ Redemption Failed",
      code_not_found: "The code you entered was not found. Please verify and try again.",
      code_used: "This code has already been redeemed. Each code can only be used once.",
      code_revoked: "This code was revoked because the related payment is no longer valid.",
      code_expired: "This code has expired. Please contact support for a new code.",
      invalid_code: "The code you entered is invalid.",
      processing_error: "There was an error processing your redemption. Please try again or contact support.",
      generic_error: "An unexpected error occurred. Please try again or contact support."
    }
  }
};
