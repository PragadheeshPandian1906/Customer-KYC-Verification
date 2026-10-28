package com.example.kyc.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {
    @Bean
    OpenAPI kycOpenApi() {
        String schemeName = "kycSession";
        return new OpenAPI()
            .info(new Info().title("Secure Customer KYC Verification API")
                .version("v1")
                .description("Session-authenticated API. Obtain a CSRF token before state-changing requests."))
            .components(new Components().addSecuritySchemes(schemeName,
                new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.COOKIE).name("KYC_SESSION")))
            .addSecurityItem(new SecurityRequirement().addList(schemeName));
    }
}
